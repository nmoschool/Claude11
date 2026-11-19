/**
 * اختبارات طرف-لطرف للمرحلة 4: بنك الأسئلة، المولّد، النماذج، الطباعة، النشر، حل الطالبات والتصحيح الآلي.
 * تتطلب بذرة جديدة: npm run db:seed
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { Client, staff, resetAuthState } from "./helpers";

const prisma = new PrismaClient();
let T: Client, S: Client;
let A = "", C = "", term = "";

before(async () => {
  await resetAuthState(prisma);
  await prisma.gradeLock.deleteMany();
  T = await staff("teacher@school.sa", "Teacher123!");
  S = await staff("supervisor@school.sa", "Supervisor123!");
  const classes = await prisma.schoolClass.findMany();
  A = classes.find((c) => c.section === "أ")!.id;
  C = classes.find((c) => c.section === "ج")!.id;
  term = (await prisma.term.findFirstOrThrow({ where: { number: 1 } })).id;
});
after(() => prisma.$disconnect());

/** يجيب عن سؤال إجابة صحيحة كاملة من مفتاحه (لاختبار التصحيح) */
function correctAnswer(q: { type: string; payload: any; answerKey: any }) {
  const k = q.answerKey;
  switch (q.type) {
    case "MCQ": case "TRUE_FALSE": return k.correct;
    case "FILL_BLANK": case "TRANSFORM": case "DICTATION": return k.accepted[0];
    case "MATCHING": return k.pairs;
    case "CLASSIFY": return k.bucketOf;
    case "ORDER_WORDS": return k.sentences[0];
    case "EXTRACT": return k.accepted.slice(0, k.count);
    case "OPEN": return "مدرستي جميلة ونظيفة.";
  }
}

let created = "";
test("البنك: إضافة مع تحقق صارم، والمشرفة لا تضيف", async () => {
  const ok = await T.json("/api/v1/questions", "POST", { type: "MCQ", stem: "جمع كلمة «قلم»:", payload: { options: ["أقلام", "قلمان", "قلمات"] }, answerKey: { correct: 0 }, skillCode: "LEX.NUMBER", difficulty: 2 });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  created = ok.data.ids[0];
  assert.equal((await T.json("/api/v1/questions", "POST", { type: "MCQ", stem: "س؟", payload: { options: ["أ", "ب"] }, answerKey: { correct: 5 } })).status, 400);
  assert.equal((await T.json("/api/v1/questions", "POST", { type: "FILL_BLANK", stem: "بلا فراغ", answerKey: { accepted: ["x"] } })).status, 400);
  assert.equal((await T.json("/api/v1/questions", "POST", { type: "MCQ", stem: "س؟", payload: { options: ["أ", "ب"] }, answerKey: { correct: 0 }, skillCode: "NOPE" })).status, 400);
  assert.equal((await S.json("/api/v1/questions", "POST", { type: "TRUE_FALSE", stem: "س؟", answerKey: { correct: true } })).status, 403);
  const list = await S.json("/api/v1/questions?skill=LEX.NUMBER");
  assert.equal(list.status, 200);
  assert.ok(list.data.questions.every((q: any) => q.skillCode === "LEX.NUMBER"));
  assert.ok(list.data.questions.some((q: any) => q.id === created));
});

test("المولّد القواعدي: مسودات صحيحة من المفردات تُحفظ دفعة", async () => {
  const r = await T.json("/api/v1/questions/generate", "POST", { kind: "SHAMS_QAMAR", count: 2, seed: 7 });
  assert.equal(r.status, 200);
  assert.ok(r.data.drafts.length >= 1);
  const SUN = "تثدذرزسشصضطظلن";
  for (const d of r.data.drafts) d.payload.items.forEach((w: string, i: number) => assert.equal(d.answerKey.bucketOf[i], SUN.includes(w[2]) ? 0 : 1, w));
  const dual = await T.json("/api/v1/questions/generate", "POST", { kind: "DUAL", count: 3, seed: 1 });
  assert.ok(dual.data.drafts.every((d: any) => d.answerKey.accepted.length === 2), "صيغتا المثنى");
  const saved = await T.json("/api/v1/questions", "POST", { questions: [...r.data.drafts, ...dual.data.drafts] });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
});

let assessmentId = "";
test("المولّد: جدول المواصفات يختار دون تكرار، والنص القرائي يأتي بأسئلته، و3 نماذج", async () => {
  const pre = await T.json("/api/v1/assessments/preview", "POST", {
    blueprint: [{ skillCode: "SPELL.TAA", count: 2 }, { type: "READING_PASSAGE", count: 1 }, { skillCode: "GRAM.NOMINAL", count: 30 }],
    seed: 99,
  });
  assert.equal(pre.status, 200);
  assert.equal(new Set(pre.data.questionIds).size, pre.data.questionIds.length);
  assert.ok(pre.data.shortages.some((s: any) => s.row === 2), "يُبلغ عن نقص المهارة");
  const passage = await prisma.question.findFirstOrThrow({ where: { type: "READING_PASSAGE" } });
  const kids = await prisma.question.findMany({ where: { parentId: passage.id } });
  for (const k of kids) assert.ok(pre.data.questionIds.includes(k.id));

  const r = await T.json("/api/v1/assessments", "POST", { kind: "QUIZ", title: "اختبار تجريبي", termId: term, durationMin: 15, versions: 3, questionIds: pre.data.questionIds });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assessmentId = r.data.id;
  const vs = await prisma.assessmentVersion.findMany({ where: { assessmentId }, orderBy: { label: "asc" } });
  assert.deepEqual(vs.map((v) => v.label), ["أ", "ب", "ج"]);
  for (const v of vs) {
    assert.deepEqual([...v.questionIds].sort(), [...vs[0].questionIds].sort(), "نفس الأسئلة");
    const pi = v.questionIds.indexOf(passage.id);
    assert.deepEqual(new Set(v.questionIds.slice(pi + 1, pi + 1 + kids.length)), new Set(kids.map((k) => k.id)), "النص متصل بأسئلته");
  }
  assert.ok(vs.some((v) => v.questionIds.join() !== vs[0].questionIds.join()), "ترتيب مختلف في نموذج آخر");

  const draft = await prisma.question.create({ data: { schoolId: (await prisma.school.findFirstOrThrow()).id, type: "TRUE_FALSE", stem: "مسودة", payload: {}, answerKey: { correct: true }, points: 1, status: "DRAFT", createdBy: "x" } });
  assert.equal((await T.json("/api/v1/assessments", "POST", { kind: "QUIZ", title: "به مسودة", termId: term, questionIds: [draft.id] })).status, 400);
  assert.equal((await T.json("/api/v1/assessments", "POST", { kind: "QUIZ", title: "نص بلا أصل", termId: term, questionIds: [kids[0].id] })).status, 400);
});

test("حماية الأسئلة المستخدمة: لا يتغير مفتاحها، والحذف يصبح أرشفة", async () => {
  const v = await prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId } });
  const q = await prisma.question.findFirstOrThrow({ where: { id: { in: v.questionIds }, type: "MCQ" } });
  const qid = q.id;
  assert.equal((await T.json(`/api/v1/questions/${qid}`, "PATCH", { answerKey: { correct: ((q.answerKey as any).correct + 1) % 2 } })).status, 409);
  assert.equal((await T.json(`/api/v1/questions/${qid}`, "PATCH", { stem: q.stem + " " })).status, 200, "تعديل الصياغة مسموح");
  const del = await T.json(`/api/v1/questions/${created}`, "DELETE");
  assert.deepEqual(del.data, { archived: false });
});

test("الطباعة: ورقة الطالبة بلا إجابات، ونموذج الإجابة للمعلمة، وPDF", async () => {
  const v = await prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId }, orderBy: { label: "asc" } });
  const sheet = await (await T.req(`/print/assessment/${v.id}`)).text();
  assert.match(sheet, /اسم الطالبة/);
  assert.ok(!/نموذج الإجابة/.test(sheet));
  const key = await (await T.req(`/print/assessment/${v.id}?answers=1`)).text();
  assert.match(key, /نموذج الإجابة/);
  assert.match(key, /✔/);
  const pdf = await T.req(`/api/v1/pdf?path=${encodeURIComponent(`/print/assessment/${v.id}`)}`);
  if (pdf.status !== 501) {
    assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  }
});

let pubId = "";
test("النشر: لفصل في النطاق مع ربط بالسجل، ومنع التكرار والمشرفة والفصل الخارجي", async () => {
  const opensAt = new Date(Date.now() - 60_000).toISOString();
  assert.equal((await S.json(`/api/v1/assessments/${assessmentId}/publish`, "POST", { classId: A, opensAt })).status, 403);
  assert.equal((await T.json(`/api/v1/assessments/${assessmentId}/publish`, "POST", { classId: C, opensAt })).status, 403);
  const r = await T.json(`/api/v1/assessments/${assessmentId}/publish`, "POST", { classId: A, opensAt, closesAt: new Date(Date.now() + 86400000).toISOString(), mode: "ONLINE" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  pubId = r.data.id;
  const item = await prisma.gradeItem.findUniqueOrThrow({ where: { id: r.data.gradeItemId }, include: { component: true } });
  assert.equal(item.component.kind, "QUIZ");
  assert.equal((await T.json(`/api/v1/assessments/${assessmentId}/publish`, "POST", { classId: A, opensAt })).status, 409);
  const batch = await T.req(`/print/assessment-batch/${pubId}`);
  assert.equal(batch.status, 200);
});

async function studentClient(index: number) {
  const cls = await prisma.schoolClass.findUniqueOrThrow({ where: { id: A } });
  const students = await prisma.student.findMany({ where: { classId: A, archived: false }, orderBy: { fullName: "asc" } });
  const st = students[index];
  const gen = await T.json(`/api/v1/classes/${A}/picture-codes`, "POST", { studentIds: [st.id] });
  const c = new Client();
  assert.equal(await c.signIn("student", { classCode: cls.joinCode, studentId: st.id, code: gen.data.cards[0].code.join("-") }), null);
  return { c, st };
}

test("الطالبة: لا يصلها مفتاح الإجابة، الحفظ التلقائي، التسليم والتصحيح الآلي ونقل الدرجة", async () => {
  const { c, st } = await studentClient(0);
  const list = await c.json("/api/v1/me/assessments");
  assert.ok(list.data.assessments.some((a: any) => a.publicationId === pubId && a.status === "OPEN"));

  const start = await c.json(`/api/v1/me/assessments/${pubId}/start`, "POST");
  assert.equal(start.status, 200, JSON.stringify(start.data));
  const json = JSON.stringify(start.data.questions);
  for (const leak of ["answerKey", "\"correct\"", "bucketOf", "\"pairs\"", "sentences", "\"accepted\""]) assert.ok(!json.includes(leak), `تسريب: ${leak}`);
  assert.ok(start.data.deadline);

  // إجابة صحيحة لكل سؤال آلي (من المفتاح في القاعدة)
  const qs = await prisma.question.findMany({ where: { id: { in: start.data.questions.map((q: any) => q.id) } } });
  const answers: Record<string, unknown> = {};
  for (const q of qs) if (q.type !== "READING_PASSAGE") answers[q.id] = correctAnswer(q as any);
  const half = Object.keys(answers).slice(0, 2);
  assert.equal((await c.json(`/api/v1/me/attempts/${start.data.attemptId}`, "PUT", { answers: Object.fromEntries(half.map((k) => [k, answers[k]])) })).status, 200);
  const resumed = await c.json(`/api/v1/me/assessments/${pubId}/start`, "POST");
  assert.equal(resumed.data.attemptId, start.data.attemptId, "استئناف نفس المحاولة");
  assert.deepEqual(Object.keys(resumed.data.answers).sort(), half.sort(), "الإجابات المحفوظة تعود");
  await c.json(`/api/v1/me/attempts/${start.data.attemptId}`, "PUT", { answers: { ...answers, "سؤال-دخيل": "x" } });

  const sub = await c.json(`/api/v1/me/attempts/${start.data.attemptId}/submit`, "POST");
  assert.equal(sub.status, 200);
  const openPts = qs.filter((q) => q.type === "OPEN").reduce((s, q) => s + Number(q.points), 0);
  const allPts = qs.filter((q) => q.type !== "READING_PASSAGE").reduce((s, q) => s + Number(q.points), 0);
  assert.equal(sub.data.max, allPts);
  assert.equal(sub.data.score, allPts - openPts, "كل الأسئلة الآلية صحيحة");
  assert.equal(sub.data.pendingManual, qs.filter((q) => q.type === "OPEN").length);

  assert.equal((await c.json(`/api/v1/me/attempts/${start.data.attemptId}/submit`, "POST")).status, 409);
  assert.equal((await c.json(`/api/v1/me/attempts/${start.data.attemptId}`, "PUT", { answers: {} })).status, 409);
  assert.equal((await c.json(`/api/v1/me/assessments/${pubId}/start`, "POST")).status, 409);
  const stored = await prisma.attempt.findUniqueOrThrow({ where: { id: start.data.attemptId } });
  assert.ok(!("سؤال-دخيل" in (stored.answers as object)), "الأسئلة الدخيلة تُتجاهل");

  // التصحيح اليدوي يكمل الدرجة وينقلها للسجل
  const pub = await prisma.assessmentPublication.findUniqueOrThrow({ where: { id: pubId } });
  if (openPts) {
    assert.equal(await prisma.gradeEntry.count({ where: { itemId: pub.gradeItemId!, studentId: st.id } }), 0, "لا تُنقل قبل اكتمال التصحيح");
    const res = await T.json(`/api/v1/publications/${pubId}/results`);
    const me = res.data.students.find((s: any) => s.student.id === st.id);
    assert.equal(me.status, "NEEDS_GRADING");
    const scores = Object.fromEntries(me.open.map((o: any) => [o.questionId, o.max]));
    assert.equal((await T.json(`/api/v1/attempts/${me.attemptId}/manual`, "PUT", { scores: Object.fromEntries(me.open.map((o: any) => [o.questionId, o.max + 1])) })).status, 400);
    assert.equal((await S.json(`/api/v1/attempts/${me.attemptId}/manual`, "PUT", { scores })).status, 403);
    const g = await T.json(`/api/v1/attempts/${me.attemptId}/manual`, "PUT", { scores });
    assert.deepEqual([g.data.final, g.data.synced], [allPts, true]);
  }
  const entry = await prisma.gradeEntry.findUniqueOrThrow({ where: { itemId_studentId: { itemId: pub.gradeItemId!, studentId: st.id } } });
  assert.equal(Number(entry.score), allPts);
  assert.equal(entry.source, "AUTO");
});

test("الطالبة الأخرى: نموذج مختلف، لا تصل لمحاولة غيرها، وإجابات خاطئة تظهر في تحليل الأخطاء", async () => {
  const { c } = await studentClient(1);
  const start = await c.json(`/api/v1/me/assessments/${pubId}/start`, "POST");
  const v = await prisma.attempt.findUniqueOrThrow({ where: { id: start.data.attemptId }, include: { version: true } });
  assert.equal(v.version.label, "ب", "التوزيع بالتناوب");
  const other = await prisma.attempt.findFirstOrThrow({ where: { publicationId: pubId, id: { not: start.data.attemptId } } });
  assert.equal((await c.json(`/api/v1/me/attempts/${other.id}`, "PUT", { answers: {} })).status, 404);
  assert.equal((await c.json(`/api/v1/me/attempts/${other.id}/submit`, "POST")).status, 404);

  const qs = await prisma.question.findMany({ where: { id: { in: v.version.questionIds } } });
  const fill = qs.find((q) => ["FILL_BLANK", "TRANSFORM", "DICTATION"].includes(q.type));
  const answers: Record<string, unknown> = {};
  if (fill) answers[fill.id] = "إجابة خاطئة";
  await c.json(`/api/v1/me/attempts/${start.data.attemptId}`, "PUT", { answers });
  const sub = await c.json(`/api/v1/me/attempts/${start.data.attemptId}/submit`, "POST");
  assert.equal(sub.data.score, 0);

  const res = await T.json(`/api/v1/publications/${pubId}/results`);
  assert.equal(res.status, 200);
  assert.equal(res.data.items.length, (await prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId, label: "أ" } })).questionIds.length);
  if (fill) assert.ok(res.data.items.find((i: any) => i.questionId === fill.id).commonWrong.some((w: any) => w.answer === "إجابة خاطئة"));
  assert.equal((await S.json(`/api/v1/publications/${pubId}/results`)).status, 200, "المشرفة ترى النتائج");
});

test("انتهاء الوقت: الحفظ مرفوض بعد الموعد والتسليم الآلي عند فتح النتائج", async () => {
  const { c, st } = await studentClient(2);
  const start = await c.json(`/api/v1/me/assessments/${pubId}/start`, "POST");
  await prisma.attempt.update({ where: { id: start.data.attemptId }, data: { startedAt: new Date(Date.now() - 60 * 60_000) } });
  assert.equal((await c.json(`/api/v1/me/attempts/${start.data.attemptId}`, "PUT", { answers: {} })).status, 409);
  await T.json(`/api/v1/publications/${pubId}/results`);
  const at = await prisma.attempt.findUniqueOrThrow({ where: { id: start.data.attemptId } });
  assert.ok(at.submittedAt, "سُلّمت آلياً");
  assert.equal(at.studentId, st.id);
});

test("الحذف: لا يُحذف اختبار له محاولات، ولا يُلغى نشر بدأت فيه الطالبات", async () => {
  assert.equal((await T.json(`/api/v1/assessments/${assessmentId}`, "DELETE")).status, 409);
  assert.equal((await T.json(`/api/v1/publications/${pubId}`, "DELETE")).status, 409);
});
