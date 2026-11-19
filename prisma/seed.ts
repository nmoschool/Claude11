/**
 * بيانات أولية لبيئة التطوير/التجربة.
 * ⚠️ يمسح كل الجداول قبل التعبئة. يرفض العمل في الإنتاج إلا مع SEED_FORCE=true.
 *
 * التواريخ وأسماء الطالبات تجريبية؛ عدّلي تواريخ الفصول وفق التقويم الدراسي الرسمي.
 */
import { PrismaClient, Role, type LessonKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptField, hashNationalId } from "../src/lib/crypto";
import { validateQuestion, type QType } from "../src/lib/questionTypes";
import { versionOrder } from "../src/lib/generator";
import { BADGES, LEVELS, bestStreak, earnedBadges, levelFor, longestDayStreak, scoreBatch } from "../src/lib/gamification";
import { GAMES, GAME_CODES } from "../src/lib/games";
import { AL_WORDS, TAA_WORDS, NUMBER_WORDS } from "../src/lib/gameWords";
import { randomUUID } from "crypto";
import { randomJoinCode, randomPictureCode, serializeCode, codeToLabels, AVATARS } from "../src/lib/pictureCode";

const prisma = new PrismaClient();

// قاموس المهارات المرجعي (مشترك مع deploy/setup-year.cjs للإنتاج)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SKILLS: [string, string, string][] = (require("./reference-skills.json") as { code: string; domain: string; title: string }[]).map((s) => [s.code, s.domain, s.title]);

// أسماء تجريبية عامة (ليست لأشخاص حقيقيين)
const FIRST = ["سارة", "نورة", "ريم", "لمى", "جود", "رهف", "شهد", "لين", "غلا", "ديم", "تالا", "رزان", "جنى", "وعد", "ليان", "مها", "هيا", "دانة", "أسيل", "رغد", "سلمى", "ملاك", "يارا", "لجين", "ميار", "عهد", "بشرى", "آلاء", "حلا", "روان", "شوق", "فجر", "نجد", "مريم", "هتان", "جوري"];
const FATHER = ["محمد", "عبدالله", "خالد", "فهد", "سعد", "ناصر", "علي", "عمر", "سلطان", "تركي", "ماجد", "إبراهيم"];
const FAMILY = ["العتيبي", "القحطاني", "الغامدي", "الزهراني", "الشهري", "الحربي", "المطيري", "الدوسري", "العنزي", "السبيعي", "الشمري", "المالكي"];

function weeksBetween(start: Date, end: Date) {
  const weeks: { number: number; start: Date; end: Date }[] = [];
  let s = new Date(start);
  let n = 1;
  while (s <= end) {
    const e = new Date(s);
    e.setUTCDate(e.getUTCDate() + 4); // الأحد ← الخميس
    weeks.push({ number: n++, start: new Date(s), end: e > end ? end : e });
    s.setUTCDate(s.getUTCDate() + 7);
  }
  return weeks;
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "true") {
    throw new Error("رفض التشغيل في الإنتاج: البذرة تمسح البيانات. استخدمي SEED_FORCE=true إن كنتِ متأكدة.");
  }

  const tables: { tablename: string }[] = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`
    );
  }

  const school = await prisma.school.create({
    data: { name: process.env.SEED_SCHOOL_NAME ?? "المدرسة الابتدائية النموذجية", region: "الإدارة العامة للتعليم" },
  });

  const year = await prisma.academicYear.create({ data: { schoolId: school.id, label: "1448هـ", current: true } });
  const termDefs = [
    { number: 1, title: "الفصل الدراسي الأول", start: "2026-08-23", end: "2027-01-07" },
    { number: 2, title: "الفصل الدراسي الثاني", start: "2027-01-17", end: "2027-06-10" },
  ];
  for (const t of termDefs) {
    const start = new Date(`${t.start}T00:00:00Z`);
    const end = new Date(`${t.end}T00:00:00Z`);
    await prisma.term.create({
      data: {
        yearId: year.id,
        number: t.number,
        title: t.title,
        startDate: start,
        endDate: end,
        weeks: { create: weeksBetween(start, end) },
      },
    });
  }

  await prisma.skill.createMany({ data: SKILLS.map(([code, domain, title]) => ({ code, domain, title })) });
  const skillId = Object.fromEntries((await prisma.skill.findMany()).map((s) => [s.code, s.id]));

  // ---------- توزيع نموذجي للفصل الأول (يُستبدل بالتوزيع الرسمي عبر «استيراد من Excel») ----------
  const term1 = await prisma.term.findFirstOrThrow({ where: { yearId: year.id, number: 1 }, include: { weeks: { orderBy: { number: "asc" } } } });
  const w = (n: number) => term1.weeks[n - 1];
  await prisma.holiday.create({ data: { termId: term1.id, title: "اليوم الوطني", start: new Date("2026-09-23T00:00:00Z"), end: new Date("2026-09-23T00:00:00Z") } });
  await prisma.holiday.create({ data: { termId: term1.id, title: "إجازة (مثال — عدّليها وفق التقويم الرسمي)", start: w(9).start, end: w(9).end } });

  const UNIT_PLAN: { title: string; lessons: [string, LessonKind, string[]][] }[] = [
    {
      title: "الوحدة الأولى (نموذج)",
      lessons: [
        ["نص الاستماع", "LISTENING", ["LISTEN"]],
        ["نص الفهم القرائي الأول", "READING", ["READ.ALOUD", "READ.COMP"]],
        ["الصنف اللغوي: الضمائر المنفصلة", "LEXICAL", ["LEX.PRONOUN"]],
        ["الأسلوب اللغوي: النداء", "GRAMMAR", ["STYLE.VOCATIVE"]],
        ["الرسم الإملائي: اللام الشمسية والقمرية", "SPELLING", ["SPELL.SHAMS_QAMAR"]],
        ["الرسم الكتابي: خط النسخ", "HANDWRITING", ["HAND.NASKH"]],
        ["التواصل الكتابي", "WRITING", ["WRITE.EXPR"]],
        ["التواصل الشفهي", "SPEAKING", ["SPEAK"]],
      ],
    },
    {
      title: "الوحدة الثانية (نموذج)",
      lessons: [
        ["نص الفهم القرائي الثاني", "READING", ["READ.COMP"]],
        ["الصنف اللغوي: المفرد والمثنى والجمع", "LEXICAL", ["LEX.NUMBER"]],
        ["الوظيفة النحوية: الجملة الاسمية", "GRAMMAR", ["GRAM.NOMINAL"]],
        ["الرسم الإملائي: التاء المربوطة والمفتوحة", "SPELLING", ["SPELL.TAA"]],
        ["الرسم الكتابي: حروف متشابهة", "HANDWRITING", ["HAND.NASKH"]],
        ["التواصل الكتابي", "WRITING", ["WRITE.EXPR"]],
        ["مراجعة الوحدة", "REVIEW", []],
      ],
    },
    {
      title: "الوحدة الثالثة (نموذج)",
      lessons: [
        ["نص الفهم القرائي الثالث", "READING", ["READ.ALOUD", "READ.COMP"]],
        ["الصنف اللغوي: الفعل الماضي والمضارع والأمر", "LEXICAL", ["LEX.VERB_TENSE"]],
        ["الوظيفة النحوية: الجملة الفعلية", "GRAMMAR", ["GRAM.VERBAL"]],
        ["الرسم الإملائي: همزتا الوصل والقطع", "SPELLING", ["SPELL.HAMZA_START"]],
        ["الأسلوب اللغوي: التعجب", "GRAMMAR", ["STYLE.EXCLAIM"]],
        ["التواصل الكتابي", "WRITING", ["WRITE.EXPR"]],
        ["مراجعة وتقويم", "REVIEW", []],
      ],
    },
  ];
  // توزيع درسين أسبوعياً على أسابيع الدراسة (تخطّي أسبوع الإجازة 9)
  const teachWeeks = term1.weeks.filter((x) => x.number !== 9);
  let slot = 0;
  const today = new Date();
  for (const [ui, u] of UNIT_PLAN.entries()) {
    const unit = await prisma.unit.create({ data: { termId: term1.id, title: u.title, order: ui + 1 } });
    for (const [li, [title, kind, skills]] of u.lessons.entries()) {
      const week = teachWeeks[Math.min(Math.floor(slot / 2), teachWeeks.length - 1)];
      slot++;
      const past = week.end < today;
      await prisma.lesson.create({
        data: {
          unitId: unit.id,
          order: li + 1,
          title,
          kind,
          periods: kind === "READING" ? 2 : 1,
          weekId: week.id,
          // لتوضيح مؤشر التغطية: معظم الدروس الماضية منفّذة ودرسان متأخران
          status: past && slot % 7 !== 0 ? "DONE" : "PLANNED",
          skills: { create: skills.map((c) => ({ skillId: skillId[c] })) },
        },
      });
    }
  }

  const classes = [];
  for (const section of ["أ", "ب", "ج"]) {
    classes.push(await prisma.schoolClass.create({ data: { schoolId: school.id, grade: 4, section, joinCode: randomJoinCode() } }));
  }
  const [A, B, C] = classes;

  const mk = async (email: string, name: string, role: Role, password: string, links: { classId: string; role: "TEACHER" | "SUPERVISOR" }[] = []) =>
    prisma.user.create({
      data: {
        schoolId: school.id,
        email,
        name,
        role,
        passwordHash: await bcrypt.hash(password, 12),
        classLinks: { create: links },
      },
    });

  const accounts = [
    { email: process.env.SEED_ADMIN_EMAIL ?? "admin@school.sa", name: "مدير النظام", role: Role.SUPER_ADMIN, password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!", links: [] },
    { email: "principal@school.sa", name: "أ. هند (القائدة)", role: Role.SCHOOL_ADMIN, password: "Principal123!", links: [] },
    { email: "teacher@school.sa", name: "أ. نوف (معلمة لغتي)", role: Role.TEACHER, password: "Teacher123!", links: [{ classId: A.id, role: "TEACHER" as const }, { classId: B.id, role: "TEACHER" as const }] },
    { email: "teacher2@school.sa", name: "أ. منيرة (معلمة لغتي)", role: Role.TEACHER, password: "Teacher123!", links: [{ classId: C.id, role: "TEACHER" as const }] },
    { email: "supervisor@school.sa", name: "أ. عائشة (المشرفة التربوية)", role: Role.SUPERVISOR, password: "Supervisor123!", links: [{ classId: A.id, role: "SUPERVISOR" as const }, { classId: B.id, role: "SUPERVISOR" as const }] },
  ];
  for (const a of accounts) await mk(a.email, a.name, a.role, a.password, a.links);

  const cards: string[] = [];
  let n = 0;
  for (const cls of classes) {
    for (let i = 0; i < 12; i++) {
      const first = FIRST[n % FIRST.length];
      const fullName = `${first} ${FATHER[(n * 7) % FATHER.length]} ${FAMILY[(n * 5) % FAMILY.length]}`;
      const nationalId = `1${String(100000000 + n * 7919).slice(-9)}`;
      const code = randomPictureCode();
      await prisma.student.create({
        data: {
          classId: cls.id,
          fullName,
          displayName: first,
          avatar: AVATARS[n % AVATARS.length],
          nationalIdEnc: encryptField(nationalId),
          nationalIdLast4: nationalId.slice(-4),
          nationalIdHash: hashNationalId(nationalId),
          guardianName: `${FATHER[(n * 7) % FATHER.length]} ${FAMILY[(n * 5) % FAMILY.length]}`,
          guardianPhoneEnc: encryptField(`05${String(10000000 + n * 1237).slice(-8)}`),
          healthNotesEnc: n % 9 === 0 ? encryptField("تستخدم نظارة طبية — تُجلس في الصفوف الأمامية") : null,
          pictureCodeHash: await bcrypt.hash(serializeCode(code), 10),
        },
      });
      if (i < 2) cards.push(`  الرابع/${cls.section} (رمز الفصل ${cls.joinCode}) — ${first}: ${codeToLabels(code)}`);
      n++;
    }
  }

  // ---------- حضور آخر 10 أيام دراسية لفصل 4/أ + أحداث نموذجية ----------
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher@school.sa" } });
  const aStudents = await prisma.student.findMany({ where: { classId: A.id }, orderBy: { fullName: "asc" } });
  const days: Date[] = [];
  for (let d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1)); days.length < 10; d.setUTCDate(d.getUTCDate() - 1)) {
    if (d.getUTCDay() <= 4) days.push(new Date(d));
  }
  for (const [di, day] of days.entries()) {
    await prisma.attendance.createMany({
      data: aStudents.map((s, si) => ({
        studentId: s.id,
        date: day,
        period: 0,
        // الطالبة الثالثة غائبة آخر 3 أيام لتوضيح تنبيه الغياب المتتالي
        status: si === 2 && di < 3 ? "ABSENT" : (si * 7 + di) % 23 === 0 ? "LATE" : (si * 3 + di) % 29 === 0 ? "EXCUSED" : "PRESENT",
        recordedBy: teacher.id,
      })),
    });
  }
  const addDays = (n: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n));
  /** اليوم الدراسي رقم n بعد اليوم (يتخطى الجمعة والسبت) */
  const schoolDay = (n: number) => {
    const d = addDays(0);
    while (n > 0) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (d.getUTCDay() <= 4) n--;
    }
    return d;
  };
  for (const cls of [A, B]) {
    await prisma.calendarEvent.createMany({
      data: [
        { classId: cls.id, type: "QUIZ", title: "اختبار قصير: الوحدة الثانية", date: schoolDay(3), createdBy: teacher.id },
        { classId: cls.id, type: "HOMEWORK", title: "واجب: كتابة فقرة عن المدرسة", date: schoolDay(1), createdBy: teacher.id },
        { classId: cls.id, type: "ACTIVITY", title: "مسابقة القراءة الجهرية", date: schoolDay(6), createdBy: teacher.id },
      ],
    });
  }
  await prisma.behaviorRecord.createMany({
    data: aStudents.slice(0, 4).map((s, i) => ({ studentId: s.id, date: addDays(-i - 1), category: i === 3 ? "نظام وانضباط" : "مشاركة", positive: i !== 3, points: i === 3 ? 1 : 2, recordedBy: teacher.id })),
  });

  // ---------- مخطط التقييم + درجات نموذجية لفصلي 4/أ و4/ب (الفصل الأول) ----------
  const DEFAULT_SCALE = [
    { min: 90, label: "ممتاز" },
    { min: 80, label: "جيد جداً" },
    { min: 70, label: "جيد" },
    { min: 50, label: "مقبول" },
    { min: 0, label: "يحتاج إلى دعم" },
  ];
  const COMPONENTS = [
    { kind: "PARTICIPATION", title: "المشاركة والتفاعل الصفي", weight: 10 },
    { kind: "HOMEWORK", title: "الواجبات", weight: 10 },
    { kind: "PERFORMANCE", title: "المهام الأدائية", weight: 20 },
    { kind: "QUIZ", title: "الاختبارات القصيرة", weight: 20 },
    { kind: "MIDTERM", title: "الاختبار الفتري", weight: 10 },
    { kind: "FINAL", title: "الاختبار النهائي", weight: 30 },
  ] as const;
  for (const t of await prisma.term.findMany({ where: { yearId: year.id } })) {
    await prisma.assessmentScheme.create({
      data: { termId: t.id, gradeScale: DEFAULT_SCALE, components: { create: COMPONENTS.map((c, i) => ({ ...c, order: i + 1 })) } },
    });
  }
  const scheme1 = await prisma.assessmentScheme.findFirstOrThrow({ where: { termId: term1.id }, include: { components: true } });
  const comp = (k: string) => scheme1.components.find((c) => c.kind === k)!.id;
  const ITEMS: { k: string; title: string; max: number; week: number; skills: string[] }[] = [
    { k: "PARTICIPATION", title: "مشاركة — الشهر الأول", max: 5, week: 4, skills: ["SPEAK"] },
    { k: "PARTICIPATION", title: "مشاركة — الشهر الثاني", max: 5, week: 8, skills: ["SPEAK"] },
    { k: "HOMEWORK", title: "واجب 1", max: 10, week: 2, skills: [] },
    { k: "HOMEWORK", title: "واجب 2", max: 10, week: 5, skills: [] },
    { k: "HOMEWORK", title: "واجب 3", max: 10, week: 10, skills: [] },
    { k: "PERFORMANCE", title: "قراءة جهرية — الوحدة 1", max: 10, week: 4, skills: ["READ.ALOUD"] },
    { k: "PERFORMANCE", title: "تعبير كتابي", max: 10, week: 7, skills: ["WRITE.EXPR"] },
    { k: "QUIZ", title: "قصير 1: اللام الشمسية والقمرية", max: 10, week: 3, skills: ["SPELL.SHAMS_QAMAR"] },
    { k: "QUIZ", title: "قصير 2: الضمائر", max: 10, week: 5, skills: ["LEX.PRONOUN"] },
    { k: "QUIZ", title: "قصير 3: التاء المربوطة والمفتوحة", max: 10, week: 8, skills: ["SPELL.TAA"] },
    { k: "QUIZ", title: "قصير 4: الجملة الاسمية", max: 10, week: 11, skills: ["GRAM.NOMINAL"] },
    { k: "MIDTERM", title: "الاختبار الفتري", max: 40, week: 10, skills: ["READ.COMP", "LEX.NUMBER", "GRAM.NOMINAL"] },
  ];
  // مولّد شبه عشوائي حتمي (نفس النتائج في كل تعبئة)
  let seedN = 1448;
  const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
  for (const cls of [A, B]) {
    const studs = await prisma.student.findMany({ where: { classId: cls.id }, orderBy: { fullName: "asc" } });
    const ability = studs.map((_, i) => 0.42 + ((i * 37) % 55) / 100); // 0.42 .. 0.96
    for (const it of ITEMS) {
      const item = await prisma.gradeItem.create({
        data: {
          classId: cls.id,
          termId: term1.id,
          componentId: comp(it.k),
          title: it.title,
          maxScore: it.max,
          date: new Date(w(it.week).start.getTime() + 2 * 86_400_000),
          skillIds: it.skills.map((c) => skillId[c]),
          createdBy: teacher.id,
        },
      });
      await prisma.gradeEntry.createMany({
        data: studs.map((st, i) => {
          const weakTaa = it.skills.includes("SPELL.TAA") && i % 4 === 1 ? -0.3 : 0;
          const r = Math.min(1, Math.max(0, ability[i] + weakTaa + (rnd() - 0.5) * 0.25));
          const absent = (i === 2 && it.k === "HOMEWORK" && it.title.endsWith("3")) || (i === 7 && it.title.startsWith("قصير 2"));
          const excused = i === 5 && it.k === "MIDTERM";
          return {
            itemId: item.id,
            studentId: st.id,
            score: absent || excused ? null : Math.round(r * it.max * 2) / 2,
            status: absent ? "ABSENT" : excused ? "EXCUSED" : "NORMAL",
            updatedBy: teacher.id,
          } as const;
        }),
      });
    }
  }

  // ---------- بنك أسئلة نموذجي + مفردات للمولّد القواعدي ----------
  const lessonFor = async (skill: string) =>
    (await prisma.lesson.findFirst({ where: { unit: { termId: term1.id }, skills: { some: { skill: { code: skill } } } }, orderBy: { order: "asc" } }))?.id ?? null;
  type QSeed = { type: QType; skill: string; stem: string; payload?: object; key: object; points?: number; difficulty?: number; children?: QSeed[] };
  const BANK: QSeed[] = [
    { type: "MCQ", skill: "SPELL.SHAMS_QAMAR", stem: "الكلمة التي فيها لام شمسية:", payload: { options: ["القمر", "الشمس", "الكتاب", "الباب"] }, key: { correct: 1 } },
    { type: "CLASSIFY", skill: "SPELL.SHAMS_QAMAR", stem: "صنّفي الكلمات الآتية حسب نوع اللام:", payload: { buckets: ["لام شمسية", "لام قمرية"], items: ["الشجرة", "النهر", "الورد", "القلم", "البحر", "الدرس"] }, key: { bucketOf: [0, 0, 1, 1, 1, 0] }, points: 3 },
    { type: "TRUE_FALSE", skill: "SPELL.SHAMS_QAMAR", stem: "اللام في كلمة «الزهرة» لام قمرية.", key: { correct: false } },
    { type: "FILL_BLANK", skill: "SPELL.TAA", stem: "أكملي بالتاء المناسبة: ذهبتُ إلى المدرسـ____ مبكرًا.", key: { accepted: ["ة"], mode: "spelling" } },
    { type: "CLASSIFY", skill: "SPELL.TAA", stem: "صنّفي الكلمات الآتية حسب نوع التاء في آخرها:", payload: { buckets: ["تاء مربوطة", "تاء مفتوحة"], items: ["شجرة", "بنت", "سيارة", "بيت", "حديقة", "كتبتْ"] }, key: { bucketOf: [0, 1, 0, 1, 0, 1] }, points: 3 },
    { type: "MCQ", skill: "SPELL.TAA", stem: "الكلمة المكتوبة كتابة صحيحة:", payload: { options: ["قطه", "قطة", "قطت"] }, key: { correct: 1 } },
    { type: "DICTATION", skill: "SPELL.TAA", stem: "اكتبي الكلمة التي تسمعينها:", payload: { say: "حديقة" }, key: { accepted: ["حديقة"], mode: "spelling" }, difficulty: 2 },
    { type: "MCQ", skill: "SPELL.HAMZA_START", stem: "الكلمة التي تبدأ بهمزة قطع:", payload: { options: ["استمع", "أكل", "انطلق", "اكتب"] }, key: { correct: 1 }, difficulty: 2 },
    { type: "DICTATION", skill: "SPELL.HAMZA_START", stem: "اكتبي الكلمة التي تسمعينها:", payload: { say: "أرنب" }, key: { accepted: ["أرنب"], mode: "spelling" } },
    { type: "DICTATION", skill: "SPELL.ALIF_LAYYINA", stem: "اكتبي الكلمة التي تسمعينها:", payload: { say: "مستشفى" }, key: { accepted: ["مستشفى"], mode: "spelling" }, difficulty: 2 },
    { type: "FILL_BLANK", skill: "LEX.PRONOUN", stem: "أكملي بالضمير المناسب (هو / هي): ____ طالبةٌ مجتهدةٌ.", key: { accepted: ["هي"], mode: "lenient" } },
    { type: "MATCHING", skill: "LEX.PRONOUN", stem: "صِلي كل ضمير بما يدل عليه:", payload: { left: ["هو", "هي", "هم", "أنتِ"], right: ["لجماعة الذكور الغائبين", "للمفرد المذكر الغائب", "للمفردة المؤنثة المخاطبة", "للمفردة المؤنثة الغائبة"] }, key: { pairs: [1, 3, 0, 2] }, points: 2, difficulty: 2 },
    { type: "MCQ", skill: "LEX.DEMONSTRATIVE", stem: "اسم الإشارة المناسب: ____ القصةُ ممتعةٌ.", payload: { options: ["هذا", "هذه", "هؤلاء", "هذان"] }, key: { correct: 1 } },
    { type: "TRANSFORM", skill: "LEX.NUMBER", stem: "حوّلي كلمة «كتاب» إلى المثنى:", payload: { source: "كتاب" }, key: { accepted: ["كتابان", "كتابين"], mode: "lenient" } },
    { type: "TRANSFORM", skill: "LEX.NUMBER", stem: "حوّلي كلمة «معلمة» إلى الجمع:", payload: { source: "معلمة" }, key: { accepted: ["معلمات"], mode: "lenient" }, difficulty: 2 },
    { type: "MCQ", skill: "LEX.NUMBER", stem: "مثنى كلمة «شجرة»:", payload: { options: ["شجرات", "شجرتان", "أشجار", "شجيرة"] }, key: { correct: 1 } },
    { type: "CLASSIFY", skill: "LEX.VERB_TENSE", stem: "صنّفي الأفعال الآتية:", payload: { buckets: ["ماضٍ", "مضارع", "أمر"], items: ["كتبَ", "يقرأُ", "اسمعْ", "لعبتْ", "تذهبُ", "ارسمي"] }, key: { bucketOf: [0, 1, 2, 0, 1, 2] }, points: 3, difficulty: 2 },
    { type: "EXTRACT", skill: "LEX.VERB_TENSE", stem: "استخرجي من النص فعلين مضارعين:", payload: { passage: "تستيقظُ سارةُ مبكرةً، فتتوضأُ وتصلي، ثم تتناولُ فطورَها وتذهبُ إلى المدرسةِ." }, key: { accepted: ["تستيقظ", "تتوضأ", "تصلي", "تتناول", "تذهب"], count: 2, mode: "lenient" }, points: 2 },
    { type: "MCQ", skill: "GRAM.NOMINAL", stem: "الجملة الاسمية فيما يأتي:", payload: { options: ["ذهبَ أحمدُ إلى السوقِ", "الحديقةُ جميلةٌ", "يلعبُ الطفلُ بالكرةِ", "اكتبي الدرسَ"] }, key: { correct: 1 } },
    { type: "TRUE_FALSE", skill: "GRAM.NOMINAL", stem: "«السماءُ صافيةٌ» جملة اسمية.", key: { correct: true } },
    { type: "MCQ", skill: "GRAM.NOMINAL", stem: "المبتدأ في جملة «العلمُ نورٌ» هو:", payload: { options: ["العلم", "نور", "الجملة كلها"] }, key: { correct: 0 }, difficulty: 2 },
    { type: "ORDER_WORDS", skill: "GRAM.VERBAL", stem: "رتّبي الكلمات لتكوّني جملة مفيدة:", payload: { words: ["إلى", "ذهبَ", "المدرسةِ", "محمدٌ"] }, key: { sentences: [["ذهبَ", "محمدٌ", "إلى", "المدرسةِ"], ["محمدٌ", "ذهبَ", "إلى", "المدرسةِ"]] }, points: 2 },
    { type: "MCQ", skill: "GRAM.VERBAL", stem: "الفاعل في جملة «قرأتْ هندُ القصةَ» هو:", payload: { options: ["قرأتْ", "هندُ", "القصةَ"] }, key: { correct: 1 }, difficulty: 2 },
    { type: "MCQ", skill: "STYLE.EXCLAIM", stem: "أسلوب التعجب فيما يأتي:", payload: { options: ["ما أجملَ السماءَ!", "ما اسمُكِ؟", "يا سارةُ، أقبلي", "لا تهملي واجبكِ"] }, key: { correct: 0 } },
    { type: "CLASSIFY", skill: "STYLE.QUESTION", stem: "صنّفي الجمل حسب الأسلوب:", payload: { buckets: ["استفهام", "نداء", "تعجب"], items: ["هل حفظتِ الدرسَ؟", "يا فاطمةُ، اجتهدي", "ما أروعَ الربيعَ!", "أين الكتابُ؟", "يا معلمتي، شكرًا"] }, key: { bucketOf: [0, 1, 2, 0, 1] }, points: 2.5, difficulty: 2 },
    { type: "OPEN", skill: "WRITE.EXPR", stem: "اكتبي ثلاث جمل عن مدرستكِ.", payload: { lines: 4 }, key: { rubric: "درجة لكل جملة مفيدة سليمة البناء", sample: "مدرستي جميلة. أحبّ معلماتي. ألعب مع صديقاتي في الفسحة." }, points: 3 },
    { type: "MCQ", skill: "READ.COMP", stem: "ضدّ كلمة «نشيطة»:", payload: { options: ["كسولة", "سريعة", "جميلة"] }, key: { correct: 0 } },
    {
      type: "READING_PASSAGE",
      skill: "READ.COMP",
      stem: "اقرئي النص الآتي ثم أجيبي:",
      payload: { passage: "تخرجُ النحلةُ في الصباحِ الباكرِ، فتطيرُ من زهرةٍ إلى زهرةٍ، تجمعُ الرحيقَ ثم تعودُ إلى الخليةِ. وفي الخليةِ يصنعُ النحلُ العسلَ، وهو غذاءٌ لذيذٌ ودواءٌ نافعٌ للناسِ. والنحلةُ لا تؤذي أحدًا إلا إذا شعرتْ بالخطرِ." },
      key: {},
      points: 0,
      difficulty: 2,
      children: [
        { type: "MCQ", skill: "READ.COMP", stem: "تجمعُ النحلةُ من الأزهارِ:", payload: { options: ["العسل", "الرحيق", "الماء"] }, key: { correct: 1 } },
        { type: "TRUE_FALSE", skill: "READ.COMP", stem: "العسلُ غذاءٌ ودواءٌ.", key: { correct: true } },
        { type: "FILL_BLANK", skill: "READ.COMP", stem: "تعودُ النحلةُ إلى ____ بعد جمعِ الرحيقِ.", key: { accepted: ["الخلية", "خليتها"], mode: "lenient" } },
        { type: "OPEN", skill: "READ.COMP", stem: "متى تؤذي النحلةُ الإنسانَ؟", payload: { lines: 2 }, key: { sample: "إذا شعرت بالخطر." }, points: 2 },
      ],
    },
  ];
  const bankIds: Record<string, string> = {};
  const addQ = async (q: QSeed, parentId: string | null = null): Promise<string> => {
    const checked = validateQuestion(q.type, q.stem, q.payload ?? {}, q.key);
    const row = await prisma.question.create({
      data: {
        schoolId: school.id,
        type: q.type,
        stem: q.stem,
        payload: checked.payload,
        answerKey: checked.answerKey,
        points: q.points ?? 1,
        difficulty: q.difficulty ?? 1,
        skillId: skillId[q.skill],
        lessonId: await lessonFor(q.skill),
        parentId,
        createdBy: teacher.id,
      },
    });
    for (const c of q.children ?? []) await addQ(c, row.id);
    return row.id;
  };
  for (const q of BANK) bankIds[q.stem] = await addQ(q);

  const vocabLesson = await lessonFor("SPELL.SHAMS_QAMAR");
  const numLesson = await lessonFor("LEX.NUMBER");
  const VOCAB: { word: string; meaning?: string; antonym?: string; dual?: string; plural?: string; lesson: string | null }[] = [
    { word: "الشمس", lesson: vocabLesson }, { word: "القمر", lesson: vocabLesson }, { word: "النهر", lesson: vocabLesson },
    { word: "الباب", lesson: vocabLesson }, { word: "الزهرة", lesson: vocabLesson }, { word: "الكتاب", lesson: vocabLesson },
    { word: "الدرس", lesson: vocabLesson }, { word: "المعلمة", lesson: vocabLesson }, { word: "السماء", lesson: vocabLesson },
    { word: "الحديقة", lesson: vocabLesson }, { word: "الطريق", lesson: vocabLesson }, { word: "الفصل", lesson: vocabLesson },
    { word: "مدرسة", dual: "مدرستان", plural: "مدارس", lesson: numLesson },
    { word: "بنت", dual: "بنتان", plural: "بنات", lesson: numLesson },
    { word: "شجرة", dual: "شجرتان", plural: "أشجار", lesson: numLesson },
    { word: "بيت", dual: "بيتان", plural: "بيوت", lesson: numLesson },
    { word: "سيارة", dual: "سيارتان", plural: "سيارات", lesson: numLesson },
    { word: "صوت", dual: "صوتان", plural: "أصوات", lesson: numLesson },
    { word: "نشيط", antonym: "كسول", meaning: "كثير العمل والحركة", lesson: vocabLesson },
    { word: "طويل", antonym: "قصير", meaning: "ممتدّ في الطول", lesson: vocabLesson },
    { word: "فرِح", antonym: "حزين", meaning: "مسرور سعيد", lesson: vocabLesson },
    { word: "نظيف", antonym: "متّسخ", meaning: "خالٍ من الوسخ", lesson: vocabLesson },
    { word: "الرحيق", meaning: "سائل حلو في الأزهار", lesson: vocabLesson },
    { word: "الخلية", meaning: "بيت النحل", lesson: vocabLesson },
  ];
  await prisma.vocabItem.createMany({ data: VOCAB.filter((v) => v.lesson).map((v) => ({ lessonId: v.lesson!, word: v.word, meaning: v.meaning, antonym: v.antonym, dual: v.dual, plural: v.plural, tags: [] })) });

  // اختبار نموذجي بنموذجين، منشور إلكترونياً لفصل 4/أ ومربوط بسجل الدرجات
  const quizIds = [
    "الكلمة التي فيها لام شمسية:", "صنّفي الكلمات الآتية حسب نوع اللام:", "أكملي بالتاء المناسبة: ذهبتُ إلى المدرسـ____ مبكرًا.",
    "صنّفي الكلمات الآتية حسب نوع التاء في آخرها:", "الكلمة التي تبدأ بهمزة قطع:", "اكتبي ثلاث جمل عن مدرستكِ.",
  ].map((st) => bankIds[st]);
  const qSeed = 424242;
  const quiz = await prisma.assessment.create({
    data: {
      kind: "QUIZ",
      title: "اختبار قصير: الرسم الإملائي",
      termId: term1.id,
      durationMin: 20,
      instructions: "اقرئي كل سؤال جيدًا قبل الإجابة.",
      createdBy: teacher.id,
      versions: {
        create: [0, 1].map((i) => ({ label: ["أ", "ب"][i], shuffleSeed: qSeed + i * 104729, questionIds: versionOrder(quizIds, {}, qSeed, i) })),
      },
    },
  });
  const quizTotal = 1 + 3 + 1 + 3 + 1 + 3;
  const quizItem = await prisma.gradeItem.create({
    data: { classId: A.id, termId: term1.id, componentId: comp("QUIZ"), title: quiz.title, maxScore: quizTotal, date: today, assessmentId: quiz.id, skillIds: ["SPELL.SHAMS_QAMAR", "SPELL.TAA", "SPELL.HAMZA_START", "WRITE.EXPR"].map((c) => skillId[c]), createdBy: teacher.id },
  });
  await prisma.assessmentPublication.create({
    data: { assessmentId: quiz.id, classId: A.id, gradeItemId: quizItem.id, mode: "ONLINE", opensAt: addDays(-1), closesAt: addDays(7), createdBy: teacher.id },
  });
  await prisma.assessment.update({ where: { id: quiz.id }, data: { publishedAt: new Date() } });

  // ---------- الألعاب: الأوسمة + لعب نموذجي لفصل 4/أ خلال آخر 10 أيام ----------
  for (const b of BADGES) await prisma.badge.create({ data: { code: b.code, title: b.title, icon: b.icon, rule: { desc: b.desc } } });
  const badgeId = Object.fromEntries((await prisma.badge.findMany()).map((b) => [b.code, b.id]));
  const players = (await prisma.student.findMany({ where: { classId: A.id }, orderBy: { fullName: "asc" } })).slice(0, 9);
  const refs: Record<string, string[]> = {
    SHAMS_GARDEN: AL_WORDS.map((w) => `b:${w}`),
    TAA_CATCHER: TAA_WORDS.map((w) => `b:${w}`),
    NUMBER_FACTORY: NUMBER_WORDS.map((n) => `b:${n.word}:dual`),
    SENTENCE_TRAIN: ["s:0", "s:1", "s:4", "s:5", "s:7"],
    MEMORY_CARDS: ["b:طويل", "b:كبير", "b:ليل", "b:صعب"],
    ECHO_DICTATION: ["b:بيت", "b:مدرسة", "b:أرنب", "b:مستشفى"],
  };
  for (const [pi, st] of players.entries()) {
    const skill = 0.45 + (pi % 5) * 0.11;
    const rows: { gameCode: string; skillCode: string; itemRef: string; correct: boolean; hintsUsed: number; ms: number; level: number; playedAt: Date }[] = [];
    for (let day = 9; day >= 0; day--) {
      if ((pi + day) % 3 === 0 && pi > 1) continue; // بعضهن لا يلعبن كل يوم
      const game = GAME_CODES[(pi + day) % (pi === 0 ? 6 : 3)];
      for (let k = 0; k < 10; k++) {
        const pool = refs[game];
        const ref = pool[(k * 7 + day + pi) % pool.length];
        // «حديقة» و«مستشفى» أصعب لتظهرا في «أصعب العناصر»
        const hard = /مستشفى|حديقة|ثبات/.test(ref) ? 0.3 : 0;
        rows.push({
          gameCode: game,
          skillCode: GAMES[game].skill,
          itemRef: ref,
          correct: rnd() < skill - hard + day * 0.012,
          hintsUsed: rnd() < 0.15 ? 1 : 0,
          ms: 2500 + Math.floor(rnd() * 6000),
          level: 1 + Math.min(2, Math.floor((10 - day) / 4)),
          playedAt: new Date(Date.now() - day * 86_400_000 - (10 - k) * 40_000 - 3_600_000),
        });
      }
    }
    if (!rows.length) continue;
    const { points } = scoreBatch(rows);
    await prisma.gameAttempt.createMany({ data: rows.map((r, i) => ({ ...r, studentId: st.id, points: points[i], clientId: randomUUID() })) });
    const total = points.reduce((a, b) => a + b, 0);
    await prisma.student.update({ where: { id: st.id }, data: { points: total } });
    const prefix: Record<string, number> = {};
    rows.forEach((r) => r.correct && (prefix[r.skillCode.split(".")[0]] = (prefix[r.skillCode.split(".")[0]] ?? 0) + 1));
    const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(d);
    for (const code of earnedBadges({ totalAttempts: rows.length, correctBySkillPrefix: prefix, bestStreak: bestStreak(rows.map((r) => r.correct)), consecutiveDays: longestDayStreak(rows.map((r) => day(r.playedAt))), improvedSkills: [], gamesPlayed: new Set(rows.map((r) => r.gameCode)).size })) {
      await prisma.studentBadge.create({ data: { studentId: st.id, badgeId: badgeId[code] } });
    }
    for (const L of LEVELS.slice(1, levelFor(total).index + 1)) {
      await prisma.certificate.create({ data: { studentId: st.id, kind: "LEVEL", ref: L.code, title: `شهادة بلوغ مستوى «${L.title}» ${L.icon}`, reason: `جمعت ${L.min} نقطة في ألعاب لغتي`, verifyCode: randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase(), issuedBy: "system" } });
    }
  }

  console.log("✅ تمت التعبئة\n");
  console.log("حسابات الطاقم (سيُطلب تفعيل التحقق الثنائي عند أول دخول):");
  for (const a of accounts) console.log(`  ${a.name.padEnd(28)} ${a.email.padEnd(24)} ${a.password}`);
  console.log("\nنماذج دخول الطالبات (بقية الرموز تُولَّد من صفحة الفصل ← بطاقات الدخول):");
  console.log(cards.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
