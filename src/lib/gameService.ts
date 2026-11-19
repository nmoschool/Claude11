import { randomInt } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/guard";
import { GAMES, GAME_CODES, type GameCode, type GameContent } from "@/lib/games";
import { AL_WORDS, ANTONYMS, DICTATION_WORDS, NUMBER_WORDS, SENTENCES, TAA_WORDS } from "@/lib/gameWords";
import { lamType, taaType } from "@/lib/vocabGenerators";
import {
  BADGES,
  DAILY_CAP,
  MIN_MS,
  bestStreak,
  earnedBadges,
  improvedSkills,
  levelFor,
  longestDayStreak,
  scoreBatch,
  LEVELS,
  type PlayerStats,
} from "@/lib/gamification";

type StudentRow = { id: string; classId: string; points: number; displayName: string };

const riyadhDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(d);

/** محتوى الألعاب: المدمج + مفردات منهج المدرسة + أسئلة «ترتيب الكلمات» من البنك */
export async function gameContent(student: StudentRow): Promise<GameContent> {
  const cls = await prisma.schoolClass.findUniqueOrThrow({ where: { id: student.classId } });
  const [vocab, orderQs] = await Promise.all([
    prisma.vocabItem.findMany({ where: { lesson: { unit: { term: { year: { schoolId: cls.schoolId, current: true } } } } } }),
    prisma.question.findMany({ where: { schoolId: cls.schoolId, type: "ORDER_WORDS", archived: false, status: "APPROVED" } }),
  ]);
  const strip = (w: string) => w.replace(/[ً-ْـ]/g, "").trim();
  const uniq = <T extends { word: string }>(xs: T[]) => Array.from(new Map(xs.map((x) => [strip(x.word), x])).values());

  return {
    alWords: uniq([...AL_WORDS.map((w) => ({ ref: `b:${w}`, word: w })), ...vocab.filter((v) => lamType(v.word)).map((v) => ({ ref: `v:${v.id}`, word: strip(v.word) }))]),
    taaWords: uniq([...TAA_WORDS.map((w) => ({ ref: `b:${w}`, word: w })), ...vocab.filter((v) => taaType(v.word)).map((v) => ({ ref: `v:${v.id}`, word: strip(v.word) }))]),
    numberWords: uniq([
      ...NUMBER_WORDS.map((n) => ({ ref: `b:${n.word}`, ...n })),
      ...vocab.filter((v) => v.dual && v.plural).map((v) => ({ ref: `v:${v.id}`, word: strip(v.word), dual: strip(v.dual!), plural: strip(v.plural!.split(/[،,]/)[0]) })),
    ]),
    antonyms: [
      ...ANTONYMS.map(([a, b]) => ({ ref: `b:${a}`, a, b })),
      ...vocab.filter((v) => v.antonym && !ANTONYMS.some(([a]) => strip(a) === strip(v.word))).map((v) => ({ ref: `v:${v.id}`, a: strip(v.word), b: strip(v.antonym!) })),
    ],
    sentences: [
      ...SENTENCES.map((s, i) => ({ ref: `s:${i}`, orders: s.map((o) => o.split(" ")) })),
      ...orderQs.map((q) => ({ ref: `q:${q.id}`, orders: (q.answerKey as { sentences: string[][] }).sentences.map((o) => o.map(strip)) })),
    ],
    dictation: ([1, 2, 3] as const).flatMap((l) => DICTATION_WORDS[l].map((w) => ({ ref: `b:${w}`, word: w, level: l }))),
  };
}

export async function enabledGames(classId: string): Promise<GameCode[]> {
  const cls = await prisma.schoolClass.findUniqueOrThrow({ where: { id: classId }, select: { disabledGames: true } });
  return GAME_CODES.filter((g) => !cls.disabledGames.includes(g));
}

export const AttemptBatch = z.object({
  attempts: z
    .array(
      z.object({
        clientId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
        gameCode: z.enum(GAME_CODES as [GameCode, ...GameCode[]]),
        skillCode: z.string().max(40),
        itemRef: z.string().max(120),
        correct: z.boolean(),
        hintsUsed: z.number().int().min(0).max(5),
        ms: z.number().int().min(0).max(600_000),
        level: z.number().int().min(1).max(3),
        playedAt: z.string().datetime({ offset: true }),
      })
    )
    .min(1)
    .max(200),
});

let badgesReady = false;
async function ensureBadges() {
  if (badgesReady) return;
  const existing = await prisma.badge.count();
  if (existing >= BADGES.length) {
    badgesReady = true;
    return;
  }
  for (const b of BADGES) {
    await prisma.badge.upsert({ where: { code: b.code }, create: { code: b.code, title: b.title, icon: b.icon, rule: { desc: b.desc } }, update: {} });
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newVerifyCode = () => Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/**
 * مزامنة محاولات اللعب (قد تكون من جلسة دون اتصال):
 * - التكرار بنفس clientId يُتجاهل (idempotent).
 * - النقاط تُحسب هنا لا على الجهاز، مع السلسلة السابقة والسقف اليومي.
 * - ثم تُقيَّم الأوسمة والمستويات وتُصدر الشهادات تلقائياً.
 */
export async function syncAttempts(student: StudentRow, raw: unknown) {
  const { attempts } = AttemptBatch.parse(raw);
  const now = Date.now();
  const allowed = new Set(await enabledGames(student.classId));
  const valid = attempts.filter((a) => {
    const t = Date.parse(a.playedAt);
    return allowed.has(a.gameCode) && t <= now + 5 * 60_000 && t >= now - 14 * 86_400_000;
  });
  const existing = new Set(
    (await prisma.gameAttempt.findMany({ where: { clientId: { in: valid.map((a) => a.clientId) } }, select: { clientId: true, studentId: true } })).map((x) => x.clientId)
  );
  const fresh = valid.filter((a) => !existing.has(a.clientId)).sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt));

  const today = riyadhDay(new Date());
  const dayStart = new Date(`${today}T00:00:00+03:00`);
  const [usedToday, last] = await Promise.all([
    prisma.gameAttempt.aggregate({ where: { studentId: student.id, createdAt: { gte: dayStart } }, _sum: { points: true } }),
    prisma.gameAttempt.findMany({ where: { studentId: student.id }, orderBy: { playedAt: "desc" }, take: 20, select: { correct: true } }),
  ]);
  let streakBefore = 0;
  for (const x of last) {
    if (!x.correct) break;
    streakBefore++;
  }
  const { points } = scoreBatch(fresh, streakBefore, usedToday._sum.points ?? 0);
  const added = points.reduce((s, p) => s + p, 0);
  const levelBefore = levelFor(student.points);

  if (fresh.length) {
    await prisma.$transaction([
      prisma.gameAttempt.createMany({
        data: fresh.map((a, i) => ({
          studentId: student.id,
          gameCode: a.gameCode,
          skillCode: a.skillCode,
          itemRef: a.itemRef,
          correct: a.correct,
          hintsUsed: a.hintsUsed,
          ms: a.ms,
          level: a.level,
          points: points[i],
          clientId: a.clientId,
          playedAt: new Date(a.playedAt),
        })),
        skipDuplicates: true,
      }),
      prisma.student.update({ where: { id: student.id }, data: { points: { increment: added } } }),
    ]);
  }
  const totalPoints = student.points + added;
  const { newBadges, newCertificates } = fresh.length ? await awardRewards(student, levelBefore.index, totalPoints) : { newBadges: [], newCertificates: [] };
  return {
    received: attempts.length,
    inserted: fresh.length,
    duplicates: valid.length - fresh.length,
    rejected: attempts.length - valid.length,
    pointsAdded: added,
    totalPoints,
    dailyCapReached: (usedToday._sum.points ?? 0) + added >= DAILY_CAP,
    level: levelFor(totalPoints),
    newBadges,
    newCertificates,
  };
}

async function playerStats(studentId: string, need: Set<string>): Promise<PlayerStats> {
  const base = { studentId, ms: { gte: MIN_MS } };
  const [total, byPrefix, games] = await Promise.all([
    prisma.gameAttempt.count({ where: base }),
    prisma.gameAttempt.groupBy({ by: ["skillCode"], where: { ...base, correct: true }, _count: true }),
    prisma.gameAttempt.groupBy({ by: ["gameCode"], where: base }),
  ]);
  const correctBySkillPrefix: Record<string, number> = {};
  for (const r of byPrefix) {
    const pre = r.skillCode.split(".")[0];
    correctBySkillPrefix[pre] = (correctBySkillPrefix[pre] ?? 0) + r._count;
  }
  // السلسلة المتتالية: يكفي آخر 60 محاولة لأن التقييم يجري عند كل مزامنة
  const recent = need.has("PERFECT_TEN")
    ? (await prisma.gameAttempt.findMany({ where: base, orderBy: { playedAt: "desc" }, take: 60, select: { correct: true } })).reverse()
    : [];
  const days = need.has("PERSISTENT")
    ? (await prisma.$queryRaw<{ d: string }[]>`SELECT DISTINCT to_char(("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD') AS d FROM "GameAttempt" WHERE "studentId" = ${studentId} AND ms >= ${MIN_MS}`).map((r) => r.d)
    : [];
  let improved: string[] = [];
  if (need.has("IMPROVER")) {
    const counts = await prisma.gameAttempt.groupBy({ by: ["skillCode"], where: base, _count: true });
    const bySkill: Record<string, boolean[]> = {};
    for (const c of counts.filter((x) => x._count >= 30)) {
      const [first, last] = await Promise.all([
        prisma.gameAttempt.findMany({ where: { ...base, skillCode: c.skillCode }, orderBy: { playedAt: "asc" }, take: 20, select: { correct: true } }),
        prisma.gameAttempt.findMany({ where: { ...base, skillCode: c.skillCode }, orderBy: { playedAt: "desc" }, take: 20, select: { correct: true } }),
      ]);
      // تسلسل تمثيلي: أول 20 + 10 وسطية افتراضية + آخر 20 (الدالة تقارن الطرفين فقط)
      bySkill[c.skillCode] = [...first.map((x) => x.correct), ...Array(10).fill(false), ...last.reverse().map((x) => x.correct)];
    }
    improved = improvedSkills(bySkill);
  }
  return {
    totalAttempts: total,
    correctBySkillPrefix,
    bestStreak: bestStreak(recent.map((r) => r.correct)),
    consecutiveDays: longestDayStreak(days),
    improvedSkills: improved,
    gamesPlayed: games.length,
  };
}

async function awardRewards(student: StudentRow, levelIndexBefore: number, totalPoints: number) {
  await ensureBadges();
  // الإجابات الأسرع من المعقول لا تمنح نقاطاً ولا أوسمة (نفس قاعدة النقاط)
  const have = new Set((await prisma.studentBadge.findMany({ where: { studentId: student.id }, include: { badge: true } })).map((b) => b.badge.code));
  const missing = new Set<string>(BADGES.map((b) => b.code).filter((c) => !have.has(c)));
  const codes = missing.size ? earnedBadges(await playerStats(student.id, missing)) : [];
  const badgeRows = await prisma.badge.findMany({ where: { code: { in: codes.filter((c) => !have.has(c)) } } });
  const newBadges = [];
  const newCertificates = [];
  for (const b of badgeRows) {
    await prisma.studentBadge.create({ data: { studentId: student.id, badgeId: b.id } });
    newBadges.push({ code: b.code, title: b.title, icon: b.icon });
    if (b.code !== "FIRST_STEP") {
      const c = await prisma.certificate.create({
        data: { studentId: student.id, kind: "BADGE", ref: b.code, title: `وسام «${b.title}» ${b.icon}`, reason: (b.rule as { desc?: string }).desc ?? null, verifyCode: newVerifyCode(), issuedBy: "system" },
      });
      newCertificates.push({ id: c.id, title: c.title });
    }
  }
  const lvl = levelFor(totalPoints);
  for (let i = levelIndexBefore + 1; i <= lvl.index; i++) {
    const L = LEVELS[i];
    const exists = await prisma.certificate.findFirst({ where: { studentId: student.id, kind: "LEVEL", ref: L.code } });
    if (exists) continue;
    const c = await prisma.certificate.create({
      data: { studentId: student.id, kind: "LEVEL", ref: L.code, title: `شهادة بلوغ مستوى «${L.title}» ${L.icon}`, reason: `جمعت ${L.min} نقطة في ألعاب لغتي`, verifyCode: newVerifyCode(), issuedBy: "system" },
    });
    newCertificates.push({ id: c.id, title: c.title });
  }
  return { newBadges, newCertificates };
}

/** نقاطي وأوسمتي + لوحة الشرف (أعلى 5 والأكثر تحسناً هذا الأسبوع) */
export async function progress(student: StudentRow) {
  await ensureBadges();
  const cls = await prisma.schoolClass.findUniqueOrThrow({ where: { id: student.classId } });
  const fresh = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
  const [badges, mine, certs] = await Promise.all([
    prisma.badge.findMany(),
    prisma.studentBadge.findMany({ where: { studentId: student.id } }),
    prisma.certificate.findMany({ where: { studentId: student.id }, orderBy: { issuedAt: "desc" } }),
  ]);
  let leaderboard = null;
  if (cls.leaderboardVisible) {
    const classmates = await prisma.student.findMany({ where: { classId: cls.id, archived: false }, select: { id: true, displayName: true, avatar: true, points: true } });
    const week = await prisma.gameAttempt.groupBy({ by: ["studentId"], where: { studentId: { in: classmates.map((c) => c.id) }, playedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, _sum: { points: true } });
    const weekOf = (id: string) => week.find((w) => w.studentId === id)?._sum.points ?? 0;
    const pub = (c: (typeof classmates)[number]) => ({ name: c.displayName, avatar: c.avatar, me: c.id === student.id });
    leaderboard = {
      top: [...classmates].filter((c) => c.points > 0).sort((a, b) => b.points - a.points).slice(0, 5).map((c) => ({ ...pub(c), points: c.points })),
      mostImproved: [...classmates].filter((c) => weekOf(c.id) > 0).sort((a, b) => weekOf(b.id) - weekOf(a.id)).slice(0, 3).map((c) => ({ ...pub(c), week: weekOf(c.id) })),
    };
  }
  return {
    points: fresh.points,
    level: levelFor(fresh.points),
    levels: LEVELS,
    badges: badges
      .map((b) => ({ code: b.code, title: b.title, icon: b.icon, desc: (b.rule as { desc?: string }).desc ?? "", earnedAt: mine.find((m) => m.badgeId === b.id)?.earnedAt ?? null }))
      .sort((a, b) => BADGES.findIndex((x) => x.code === a.code) - BADGES.findIndex((x) => x.code === b.code)),
    certificates: certs.map((c) => ({ id: c.id, title: c.title, issuedAt: c.issuedAt })),
    leaderboard,
  };
}

/** لوحة أداء الألعاب للمعلمة — تجميع داخل قاعدة البيانات (عشرات آلاف المحاولات لكل فصل) */
export async function gameAnalytics(classId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const cls = await prisma.schoolClass.findUniqueOrThrow({ where: { id: classId } });
  const students = await prisma.student.findMany({ where: { classId, archived: false }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, avatar: true, points: true, _count: { select: { badges: true } } } });
  const where = { studentId: { in: students.map((s) => s.id) }, playedAt: { gte: since } };
  const [byGameRows, bySkillRows, byItemRows, byStudentRows, lastPlayed, playersPerGame] = await Promise.all([
    prisma.gameAttempt.groupBy({ by: ["gameCode", "correct"], where, _count: true, _sum: { ms: true } }),
    prisma.gameAttempt.groupBy({ by: ["skillCode", "correct"], where, _count: true }),
    prisma.gameAttempt.groupBy({ by: ["gameCode", "itemRef", "correct"], where: { ...where, itemRef: { not: "board" } }, _count: true }),
    prisma.gameAttempt.groupBy({ by: ["studentId", "correct"], where, _count: true, _sum: { ms: true } }),
    prisma.gameAttempt.groupBy({ by: ["studentId"], where, _max: { playedAt: true } }),
    prisma.gameAttempt.groupBy({ by: ["gameCode", "studentId"], where }),
  ]);
  const acc = (rows: { correct: boolean; _count: number }[]) => {
    const n = rows.reduce((s, r) => s + r._count, 0);
    return n ? Math.round((rows.filter((r) => r.correct).reduce((s, r) => s + r._count, 0) / n) * 100) : null;
  };
  const count = (rows: { _count: number }[]) => rows.reduce((s, r) => s + r._count, 0);
  const mins = (rows: { _sum: { ms: number | null } }[]) => Math.round(rows.reduce((s, r) => s + (r._sum.ms ?? 0), 0) / 60000);

  const byGame = GAME_CODES.map((g) => {
    const rows = byGameRows.filter((r) => r.gameCode === g);
    return { code: g, title: GAMES[g].title, icon: GAMES[g].icon, enabled: !cls.disabledGames.includes(g), attempts: count(rows), players: playersPerGame.filter((p) => p.gameCode === g).length, accuracy: acc(rows), minutes: mins(rows) };
  });
  const skillCodes = Array.from(new Set(bySkillRows.map((r) => r.skillCode)));
  const skills = await prisma.skill.findMany({ where: { code: { in: skillCodes } } });
  const bySkill = skillCodes
    .map((code) => {
      const rows = bySkillRows.filter((r) => r.skillCode === code);
      return { code, title: skills.find((s) => s.code === code)?.title ?? code, attempts: count(rows), accuracy: acc(rows) };
    })
    .sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100));

  const items = new Map<string, { gameCode: string; itemRef: string; n: number; ok: number }>();
  for (const r of byItemRows) {
    const k = `${r.gameCode}|${r.itemRef}`;
    const it = items.get(k) ?? { gameCode: r.gameCode, itemRef: r.itemRef, n: 0, ok: 0 };
    it.n += r._count;
    if (r.correct) it.ok += r._count;
    items.set(k, it);
  }
  const hardestRaw = [...items.values()].filter((i) => i.n >= 3).sort((a, b) => a.ok / a.n - b.ok / b.n).slice(0, 10);
  const vocabIds = hardestRaw.map((i) => i.itemRef.match(/^v:([^:]+)/)?.[1]).filter(Boolean) as string[];
  const vocab = await prisma.vocabItem.findMany({ where: { id: { in: vocabIds } }, select: { id: true, word: true } });
  const label = (ref: string) => {
    const [kind, rest, extra] = ref.split(":");
    const base = kind === "v" ? vocab.find((v) => v.id === rest)?.word ?? "مفردة" : kind === "s" ? `جملة ${Number(rest) + 1}` : kind === "q" ? "جملة من البنك" : rest;
    return extra ? `${base} (${extra === "dual" ? "مثنى" : "جمع"})` : base;
  };
  const hardest = hardestRaw.map((i) => ({ game: GAMES[i.gameCode as GameCode]?.title ?? i.gameCode, item: label(i.itemRef), attempts: i.n, accuracy: Math.round((i.ok / i.n) * 100) }));

  const studentsOut = students.map((s) => {
    const rows = byStudentRows.filter((r) => r.studentId === s.id);
    const last = lastPlayed.find((l) => l.studentId === s.id)?._max.playedAt ?? null;
    return { id: s.id, fullName: s.fullName, avatar: s.avatar, points: s.points, level: levelFor(s.points).title, badges: s._count.badges, attempts: count(rows), accuracy: acc(rows), minutes: mins(rows), lastPlayed: last, playedThisWeek: !!last && last >= weekAgo };
  });

  return {
    class: { id: cls.id, leaderboardVisible: cls.leaderboardVisible, disabledGames: cls.disabledGames },
    days,
    totals: { attempts: count(byGameRows), accuracy: acc(byGameRows), players: lastPlayed.length, minutes: mins(byGameRows) },
    byGame,
    bySkill,
    hardest,
    students: studentsOut,
    notPlayedThisWeek: studentsOut.filter((s) => !s.playedThisWeek).map((s) => s.fullName),
  };
}

export async function loadCertificateForStudent(studentId: string, id: string) {
  const c = await prisma.certificate.findFirst({ where: { id, studentId } });
  if (!c) throw new HttpError(404, "NOT_FOUND", "الشهادة غير موجودة");
  return c;
}
