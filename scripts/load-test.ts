/**
 * اختبار الحمل (بلا اعتماديات خارجية) — مؤشرات الأداء المستهدفة في docs القسم 7.7:
 *   - زمن API (p95) < 300ms
 *   - فتح سجل درجات 35 طالبة × 30 عموداً < 1 ثانية
 *   - مسابقة/لعب متزامن لـ 40 جهازاً
 *   - توليد PDF ورقة < 3 ثوانٍ
 *
 *   BASE_URL=http://localhost:3000 DATABASE_URL=... FIELD_ENCRYPTION_KEY=... npx tsx scripts/load-test.ts
 * يُنشئ فصلاً تجريبياً «4/هـ» (35 طالبة × 30 تقييماً) ويحذفه في النهاية.
 */
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { Client, staff, resetAuthState } from "../tests/e2e/helpers";

const prisma = new PrismaClient();
const SECTION = "هـ";

interface Result { name: string; n: number; errors: number; p50: number; p95: number; p99: number; max: number; rps: number; target?: number }

function pct(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : 0;
}

/** يشغّل `concurrency` عاملاً متوازياً لمدة `seconds` أو حتى `total` طلب */
async function run(name: string, concurrency: number, opts: { seconds?: number; total?: number; target?: number }, fn: (worker: number, i: number) => Promise<boolean>): Promise<Result> {
  const times: number[] = [];
  let errors = 0;
  let issued = 0;
  const end = Date.now() + (opts.seconds ?? 3600) * 1000;
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: concurrency }, async (_, w) => {
      while (Date.now() < end && (opts.total === undefined || issued < opts.total)) {
        const i = issued++;
        const s = performance.now();
        let ok = false;
        try {
          ok = await fn(w, i);
        } catch {
          ok = false;
        }
        times.push(performance.now() - s);
        if (!ok) errors++;
      }
    })
  );
  const r = { name, n: times.length, errors, p50: pct(times, 50), p95: pct(times, 95), p99: pct(times, 99), max: Math.max(0, ...times), rps: times.length / ((Date.now() - t0) / 1000), target: opts.target };
  const verdict = r.target === undefined ? "" : r.p95 <= r.target && r.errors === 0 ? "✅" : "✖";
  console.log(`${verdict} ${name}: n=${r.n} أخطاء=${r.errors} p50=${r.p50.toFixed(0)}ms p95=${r.p95.toFixed(0)}ms p99=${r.p99.toFixed(0)}ms أقصى=${r.max.toFixed(0)}ms (${r.rps.toFixed(1)} طلب/ث)${r.target ? ` — الهدف p95 ≤ ${r.target}ms` : ""}`);
  return r;
}

async function setup() {
  const school = await prisma.school.findFirstOrThrow();
  const term = await prisma.term.findFirstOrThrow({ where: { number: 1 } });
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher@school.sa" } });
  await teardown();
  const cls = await prisma.schoolClass.create({ data: { schoolId: school.id, grade: 4, section: SECTION, joinCode: "LOADXX" } });
  await prisma.classStaff.create({ data: { userId: teacher.id, classId: cls.id, role: "TEACHER" } });
  const hash = await bcrypt.hash("0-1-2-3", 10);
  await prisma.student.createMany({ data: Array.from({ length: 35 }, (_, i) => ({ classId: cls.id, fullName: `طالبة اختبار الحمل ${i + 1}`, displayName: `ط${i + 1}`, pictureCodeHash: hash })) });
  const students = await prisma.student.findMany({ where: { classId: cls.id } });
  const scheme = await prisma.assessmentScheme.findFirstOrThrow({ where: { termId: term.id }, include: { components: true } });
  for (let k = 0; k < 30; k++) {
    const item = await prisma.gradeItem.create({ data: { classId: cls.id, termId: term.id, componentId: scheme.components[k % scheme.components.length].id, title: `تقييم ${k + 1}`, maxScore: 10, date: new Date() } });
    await prisma.gradeEntry.createMany({ data: students.map((s, i) => ({ itemId: item.id, studentId: s.id, score: (i + k) % 11, updatedBy: teacher.id })) });
  }
  return { cls, term, students };
}

async function teardown() {
  const cls = await prisma.schoolClass.findFirst({ where: { section: SECTION } });
  if (!cls) return;
  await prisma.gradeItem.deleteMany({ where: { classId: cls.id } });
  await prisma.student.deleteMany({ where: { classId: cls.id } });
  await prisma.schoolClass.delete({ where: { id: cls.id } });
}

(async () => {
  await resetAuthState(prisma);
  const { cls, term, students } = await setup();
  console.log(`إعداد: فصل ${SECTION} — ${students.length} طالبة × 30 تقييماً (${students.length * 30} درجة)\n`);
  const T = await staff("teacher@school.sa", "Teacher123!");
  const results: Result[] = [];

  // تسخين
  for (let i = 0; i < 3; i++) await T.req(`/api/v1/classes/${cls.id}/gradebook?term=${term.id}`);

  results.push(await run("سجل الدرجات 35×30 — 10 معلمات متزامنات", 10, { seconds: 15, target: 1000 }, async () => (await T.req(`/api/v1/classes/${cls.id}/gradebook?term=${term.id}`)).ok));

  // 40 طالبة: دخول ثم مزامنة لعب متزامنة
  const kids: Client[] = [];
  for (const s of students.slice(0, 35)) {
    const c = new Client();
    if ((await c.signIn("student", { classCode: cls.joinCode, studentId: s.id, code: "0-1-2-3" })) === null) kids.push(c);
  }
  console.log(`دخلت ${kids.length} طالبة (من نفس عنوان IP — محاكاة NAT المدرسة)`);
  results.push(
    await run("مزامنة الألعاب — 35 جهازاً متزامناً (دفعة 10 إجابات)", kids.length, { seconds: 15, target: 300 }, async (w) => {
      const attempts = Array.from({ length: 10 }, () => ({ clientId: randomUUID(), gameCode: "SHAMS_GARDEN", skillCode: "SPELL.SHAMS_QAMAR", itemRef: "b:الشمس", correct: Math.random() < 0.7, hintsUsed: 0, ms: 3000, level: 1, playedAt: new Date().toISOString() }));
      return (await kids[w].json("/api/v1/me/game-attempts", "POST", { attempts })).status === 200;
    })
  );
  results.push(await run("قائمة ألعاب الطالبة — 35 جهازاً", kids.length, { seconds: 10, target: 300 }, async (w) => (await kids[w].req("/api/v1/me/games")).ok));
  results.push(await run("لوحة ألعاب المعلمة (تحليل كل المحاولات)", 5, { seconds: 10, target: 1000 }, async () => (await T.req(`/api/v1/classes/${cls.id}/games/analytics?days=30`)).ok));
  results.push(await run("كشف حضور اليوم", 10, { seconds: 10, target: 300 }, async () => (await T.req(`/api/v1/classes/${cls.id}/attendance`)).ok));

  // PDF
  const pdfPath = `/print/report-card/${students[0].id}?term=${term.id}`;
  const probe = await T.req(`/api/v1/pdf?path=${encodeURIComponent(pdfPath)}`);
  if (probe.status === 501) console.log("⚠️ PDF على الخادم غير مفعّل — تخطي");
  else {
    results.push(await run("PDF بطاقة طالبة — تسلسلي", 1, { total: 6, target: 3000 }, async () => (await T.req(`/api/v1/pdf?path=${encodeURIComponent(pdfPath)}`)).status === 200));
    let busy = 0;
    results.push(
      await run("PDF — 6 طلبات متزامنة (حد التوازي 2)", 6, { total: 6 }, async () => {
        const r = await T.req(`/api/v1/pdf?path=${encodeURIComponent(pdfPath)}`);
        if (r.status === 503) busy++;
        return r.status === 200 || r.status === 503;
      })
    );
    console.log(`   ↳ رُفض ${busy} طلب بـ 503 «الخادم مشغول» (حماية من استنزاف الذاكرة) — الواجهة تطلب إعادة المحاولة`);
  }

  await prisma.gameAttempt.deleteMany({ where: { studentId: { in: students.map((s) => s.id) } } });
  await teardown();
  await prisma.$disconnect();
  const failed = results.filter((r) => r.target !== undefined && (r.p95 > r.target || r.errors));
  console.log(`\n${failed.length ? `✖ ${failed.length} مؤشر خارج الهدف` : "✅ كل المؤشرات ضمن الأهداف"}`);
  process.exit(failed.length ? 1 : 0);
})();
