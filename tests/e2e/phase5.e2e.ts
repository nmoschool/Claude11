/**
 * اختبارات طرف-لطرف للمرحلة 5: الألعاب، المزامنة دون تكرار، النقاط على الخادم، الأوسمة والشهادات، لوحة المعلمة.
 * تتطلب بذرة جديدة: npm run db:seed
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { Client, staff, resetAuthState } from "./helpers";

const prisma = new PrismaClient();
let T: Client, S: Client;
let A = "";

before(async () => {
  await resetAuthState(prisma);
  T = await staff("teacher@school.sa", "Teacher123!");
  S = await staff("supervisor@school.sa", "Supervisor123!");
  A = (await prisma.schoolClass.findFirstOrThrow({ where: { section: "أ" } })).id;
  await prisma.schoolClass.update({ where: { id: A }, data: { disabledGames: [], leaderboardVisible: true } });
});
after(() => prisma.$disconnect());

/** طالبة بلا لعب سابق (الأخيرة أبجدياً — البذرة تُلعب أول 9) */
async function freshStudent() {
  const cls = await prisma.schoolClass.findUniqueOrThrow({ where: { id: A } });
  const students = await prisma.student.findMany({ where: { classId: A, archived: false }, orderBy: { fullName: "asc" } });
  const st = students.find((s) => s.points === 0 && !s.fullName.startsWith("تجربة"))!;
  await prisma.gameAttempt.deleteMany({ where: { studentId: st.id } });
  await prisma.studentBadge.deleteMany({ where: { studentId: st.id } });
  await prisma.certificate.deleteMany({ where: { studentId: st.id } });
  await prisma.student.update({ where: { id: st.id }, data: { points: 0 } });
  const gen = await T.json(`/api/v1/classes/${A}/picture-codes`, "POST", { studentIds: [st.id] });
  const c = new Client();
  assert.equal(await c.signIn("student", { classCode: cls.joinCode, studentId: st.id, code: gen.data.cards[0].code.join("-") }), null);
  return { c, st };
}

const att = (over: Partial<Record<string, unknown>> = {}) => ({
  clientId: randomUUID(),
  gameCode: "SHAMS_GARDEN",
  skillCode: "SPELL.SHAMS_QAMAR",
  itemRef: "b:الشمس",
  correct: true,
  hintsUsed: 0,
  ms: 2500,
  level: 1,
  playedAt: new Date(Date.now() - 60_000).toISOString(),
  ...over,
});

let student: Awaited<ReturnType<typeof freshStudent>>;

test("المحتوى: حزمة كاملة للعب دون اتصال تتضمن مفردات المنهج وجمل البنك", async () => {
  student = await freshStudent();
  const r = await student.c.json("/api/v1/me/games/content");
  assert.equal(r.status, 200);
  const c = r.data.content;
  for (const k of ["alWords", "taaWords", "numberWords", "antonyms", "sentences", "dictation"]) assert.ok(c[k].length >= 4, k);
  assert.ok(c.alWords.some((w: any) => w.ref.startsWith("v:")) || c.taaWords.some((w: any) => w.ref.startsWith("v:")), "مفردات المنهج");
  assert.ok(c.sentences.some((s: any) => s.ref.startsWith("q:")), "جمل من بنك الأسئلة");
  assert.equal(r.data.enabled.length, 6);
  assert.equal((await new Client().json("/api/v1/me/games/content")).status, 401);
  assert.equal((await T.json("/api/v1/me/games/content")).status, 401, "حساب الطاقم ليس طالبة");
});

test("المزامنة: النقاط تُحسب على الخادم، وإعادة الإرسال لا تكرر شيئاً", async () => {
  const batch = [...Array.from({ length: 5 }, () => att()), att({ correct: false }), att({ hintsUsed: 1 })];
  const r1 = await student.c.json("/api/v1/me/game-attempts", "POST", { attempts: batch });
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  // 15×4 + (15+20) + 0 + 10
  assert.equal(r1.data.pointsAdded, 105);
  assert.equal(r1.data.inserted, 7);
  assert.ok(r1.data.newBadges.some((b: any) => b.code === "FIRST_STEP"));

  const r2 = await student.c.json("/api/v1/me/game-attempts", "POST", { attempts: batch });
  assert.deepEqual([r2.data.inserted, r2.data.duplicates, r2.data.pointsAdded, r2.data.totalPoints], [0, 7, 0, 105]);
  assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: student.st.id } })).points, 105);
  assert.equal(await prisma.gameAttempt.count({ where: { studentId: student.st.id } }), 7);
});

test("المزامنة: رفض المستقبل والقديم جداً واللعبة المعطلة، والإجابة الأسرع من المعقول بلا نقاط", async () => {
  await prisma.schoolClass.update({ where: { id: A }, data: { disabledGames: ["MEMORY_CARDS"] } });
  const r = await student.c.json("/api/v1/me/game-attempts", "POST", {
    attempts: [
      att({ playedAt: new Date(Date.now() + 3_600_000).toISOString() }),
      att({ playedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() }),
      att({ gameCode: "MEMORY_CARDS" }),
      att({ ms: 50 }),
    ],
  });
  assert.deepEqual([r.data.rejected, r.data.inserted, r.data.pointsAdded], [3, 1, 0]);
  await prisma.schoolClass.update({ where: { id: A }, data: { disabledGames: [] } });
  assert.equal((await student.c.json("/api/v1/me/game-attempts", "POST", { attempts: [{ ...att(), gameCode: "HACK" }] })).status, 400);
  assert.equal((await student.c.json("/api/v1/me/game-attempts", "POST", { attempts: [att({ hintsUsed: -1 })] })).status, 400);
});

test("المستوى والشهادة التلقائية مع رمز تحقق عام لا يكشف الاسم الكامل", async () => {
  const many = Array.from({ length: 12 }, (_, i) => att({ itemRef: `b:w${i}`, playedAt: new Date(Date.now() - (20 - i) * 1000).toISOString() }));
  const r = await student.c.json("/api/v1/me/game-attempts", "POST", { attempts: many });
  assert.ok(r.data.totalPoints >= 200);
  assert.equal(r.data.level.code, "FLOWER");
  const cert = r.data.newCertificates.find((c: any) => /زهرة/.test(c.title));
  assert.ok(cert, JSON.stringify(r.data.newCertificates));
  assert.ok(r.data.newBadges.some((b: any) => b.code === "PERFECT_TEN"), "10 متتالية");

  const row = await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } });
  const page = await (await new Client().req(`/verify/${row.verifyCode}`)).text();
  assert.match(page, /شهادة صحيحة/);
  const [first, ...rest] = student.st.fullName.split(" ");
  assert.match(page, new RegExp(first));
  assert.ok(!page.includes(student.st.fullName), "لا يظهر الاسم الكامل");
  assert.ok(!page.includes(rest[rest.length - 1]), "لا يظهر اسم العائلة");
  assert.match(await (await new Client().req("/verify/ZZZZZZZZZZ")).text(), /لم نجد/);

  assert.equal((await student.c.req(`/student/certificates/${cert.id}`)).status, 200);
  const other = await prisma.certificate.findFirstOrThrow({ where: { studentId: { not: student.st.id } } });
  assert.equal((await student.c.req(`/student/certificates/${other.id}`)).status, 404, "لا تفتح شهادة غيرها");
});

test("الإجابات الآلية السريعة لا تمنح أوسمة", async () => {
  const bot = await freshStudent();
  const fast = Array.from({ length: 12 }, (_, i) => att({ ms: 120, itemRef: `b:f${i}`, playedAt: new Date(Date.now() - (30 - i) * 1000).toISOString() }));
  const r = await bot.c.json("/api/v1/me/game-attempts", "POST", { attempts: fast });
  assert.equal(r.data.pointsAdded, 0);
  assert.equal(r.data.inserted, 12, "تُسجَّل للتحليل");
  assert.deepEqual(r.data.newBadges, [], "لا أوسمة");
  assert.deepEqual(r.data.newCertificates, []);
  student = await freshStudent();
  await student.c.json("/api/v1/me/game-attempts", "POST", { attempts: Array.from({ length: 30 }, (_, i) => att({ itemRef: `b:r${i}`, playedAt: new Date(Date.now() - (40 - i) * 1000).toISOString() })) });
});

test("السقف اليومي يوقف النقاط ولا يوقف اللعب", async () => {
  await prisma.gameAttempt.create({ data: { studentId: student.st.id, gameCode: "TAA_CATCHER", skillCode: "SPELL.TAA", itemRef: "x", correct: true, hintsUsed: 0, ms: 3000, level: 1, points: 1490, clientId: randomUUID() } });
  const r = await student.c.json("/api/v1/me/game-attempts", "POST", { attempts: [att({ gameCode: "TAA_CATCHER", skillCode: "SPELL.TAA" }), att({ gameCode: "TAA_CATCHER", skillCode: "SPELL.TAA" })] });
  assert.equal(r.data.inserted, 2);
  assert.ok(r.data.pointsAdded <= 10);
  assert.equal(r.data.dailyCapReached, true);
});

test("لوحة الشرف: تظهر بالاسم الأول فقط، وتخفيها المعلمة، والمشرفة لا تغيّر الإعدادات", async () => {
  const p = await student.c.json("/api/v1/me/progress");
  assert.ok(p.data.leaderboard.top.length > 0);
  assert.ok(p.data.leaderboard.top.every((x: any) => !x.name.includes(" ")), "الاسم الأول فقط");
  assert.ok(p.data.badges.some((b: any) => b.earnedAt) && p.data.badges.some((b: any) => !b.earnedAt));
  assert.equal((await S.json(`/api/v1/classes/${A}/games/settings`, "PATCH", { leaderboardVisible: false })).status, 403);
  assert.equal((await T.json(`/api/v1/classes/${A}/games/settings`, "PATCH", { leaderboardVisible: false })).status, 200);
  assert.equal((await student.c.json("/api/v1/me/progress")).data.leaderboard, null);
  await T.json(`/api/v1/classes/${A}/games/settings`, "PATCH", { leaderboardVisible: true });
});

test("لوحة المعلمة: الإحصاءات وأصعب العناصر ومن لم تلعب، والشهادة اليدوية وطباعتها", async () => {
  const r = await S.json(`/api/v1/classes/${A}/games/analytics?days=30`);
  assert.equal(r.status, 200, "المشرفة تقرأ");
  assert.equal(r.data.byGame.length, 6);
  assert.ok(r.data.totals.attempts > 600);
  assert.ok(r.data.hardest.length > 0 && r.data.hardest[0].accuracy <= r.data.hardest.at(-1).accuracy);
  assert.ok(r.data.notPlayedThisWeek.length > 0);
  const C = (await prisma.schoolClass.findFirstOrThrow({ where: { section: "ج" } })).id;
  assert.equal((await T.json(`/api/v1/classes/${C}/games/analytics`)).status, 403);

  assert.equal((await S.json(`/api/v1/students/${student.st.id}/certificates`, "POST", { title: "شهادة تقدير" })).status, 403);
  const c = await T.json(`/api/v1/students/${student.st.id}/certificates`, "POST", { title: "شهادة تميز في القراءة الجهرية", reason: "لأدائها المتميز" });
  assert.equal(c.status, 200);
  const page = await T.req(`/print/certificate/${c.data.id}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /شهادة تميز في القراءة الجهرية/);
  const pdf = await T.req(`/api/v1/pdf?path=${encodeURIComponent(`/print/certificate/${c.data.id}`)}&landscape=1`);
  if (pdf.status !== 501) assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  const list = await student.c.req("/student/certificates");
  assert.match(await list.text(), /شهادة تميز في القراءة الجهرية/);
});

test("الصفحات الثابتة للعب دون اتصال: عامل الخدمة والبيان", async () => {
  const sw = await new Client().req("/sw.js");
  assert.equal(sw.status, 200);
  const js = await sw.text();
  assert.match(js, /lughati-games/);
  assert.ok(!/\/api\/v1\/me\/game-attempts/.test(js), "لا يُخزّن واجهات الكتابة");
  const m = await new Client().json("/manifest.webmanifest");
  assert.equal(m.data.dir, "rtl");
  assert.equal(m.data.start_url, "/student");
});
