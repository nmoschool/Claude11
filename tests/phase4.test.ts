import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAr, matchesAny } from "../src/lib/arabicNormalize";
import { gradeQuestion, gradeAttempt } from "../src/lib/autoGrade";
import { validateQuestion } from "../src/lib/questionTypes";
import { pickQuestions, versionOrder, permutation, versionForStudent, type PoolQuestion } from "../src/lib/generator";
import { generateDrafts, lamType, taaType, dualVariants } from "../src/lib/vocabGenerators";

test("التطبيع: التشكيل والتطويل والترقيم والمسافات والأرقام", () => {
  assert.equal(normalizeAr("  ذَهَبَتْ   الطّالِبـــةُ،  "), "ذهبت الطالبه");
  assert.equal(normalizeAr("الصف ٤"), "الصف 4");
});

test("وضع الإملاء يحافظ على الهمزة والتاء المربوطة والألف المقصورة", () => {
  assert.ok(matchesAny("مَدْرَسَةٌ", ["مدرسة"], "spelling"));
  assert.ok(!matchesAny("مدرسه", ["مدرسة"], "spelling"), "التاء المربوطة مهارة مقاسة");
  assert.ok(!matchesAny("اكل", ["أكل"], "spelling"), "الهمزة مهارة مقاسة");
  assert.ok(!matchesAny("مستشفي", ["مستشفى"], "spelling"));
});

test("الوضع المتساهل لا يعاقب على الإملاء في سؤال نحوي", () => {
  assert.ok(matchesAny("مدرسه", ["مدرسة"], "lenient"));
  assert.ok(matchesAny("اكل", ["أكل"], "lenient"));
  assert.ok(matchesAny("إلى المدرسه", ["الى المدرسة"], "lenient"));
  assert.ok(matchesAny("مسؤول", ["مسئول"], "lenient"));
  assert.ok(!matchesAny("كتب", ["كتاب"], "lenient"), "لا يقبل كلمة مختلفة");
  assert.ok(!matchesAny("", ["أ"], "lenient"));
});

const Q = (type: any, payload: any, answerKey: any, points = 2) => ({ id: "q", type, points, payload, answerKey });

test("تصحيح: اختيار من متعدد وصواب وخطأ", () => {
  assert.equal(gradeQuestion(Q("MCQ", { options: ["أ", "ب", "ج"] }, { correct: 1 }), 1).score, 2);
  assert.equal(gradeQuestion(Q("MCQ", { options: ["أ", "ب", "ج"] }, { correct: 1 }), 2).score, 0);
  assert.equal(gradeQuestion(Q("TRUE_FALSE", {}, { correct: false }), false).score, 2);
  assert.equal(gradeQuestion(Q("TRUE_FALSE", {}, { correct: false }), null).score, 0);
});

test("تصحيح: درجة جزئية للتوصيل والتصنيف", () => {
  assert.equal(gradeQuestion(Q("MATCHING", {}, { pairs: [2, 0, 1, 3] }, 4), [2, 0, 3, 1]).score, 2);
  assert.equal(gradeQuestion(Q("CLASSIFY", {}, { bucketOf: [0, 1, 1] }, 3), [0, 1, 0]).score, 2);
});

test("تصحيح: ترتيب الكلمات يقبل أكثر من ترتيب صحيح", () => {
  const q = Q("ORDER_WORDS", { words: ["الطالبة", "ذهبت", "إلى المدرسة"] }, { sentences: [["ذهبت", "الطالبة", "إلى المدرسة"], ["الطالبة", "ذهبت", "إلى المدرسة"]] });
  assert.equal(gradeQuestion(q, ["الطالبة", "ذهبت", "إلى المدرسة"]).score, 2);
  assert.equal(gradeQuestion(q, ["إلى المدرسة", "ذهبت", "الطالبة"]).score, 0);
});

test("تصحيح: الاستخراج يحتسب الكلمات المختلفة الصحيحة فقط", () => {
  const q = Q("EXTRACT", { passage: "..." }, { accepted: ["يلعب", "تقرأ", "يكتب"], count: 2, mode: "lenient" });
  assert.equal(gradeQuestion(q, ["يلعب", "يلعب"]).score, 1, "التكرار لا يُحتسب مرتين");
  assert.equal(gradeQuestion(q, ["يلعب", "تقرا"]).score, 2);
  assert.equal(gradeQuestion(q, ["يلعب", "قلم", "يكتب"]).score, 2, "لا يتجاوز العدد المطلوب");
});

test("تصحيح: الإملاء الصوتي صارم، والتحويل متساهل، والمفتوح يدوي", () => {
  const d = Q("DICTATION", { say: "مستشفى" }, { accepted: ["مستشفى"], mode: "spelling" });
  assert.equal(gradeQuestion(d, "مُسْتَشْفَى").score, 2);
  assert.equal(gradeQuestion(d, "مستشفي").score, 0);
  assert.equal(gradeQuestion(d, "مستشفي").wrongAnswer, "مستشفي");
  const t = Q("TRANSFORM", { source: "مدرسة" }, { accepted: ["مدرستان", "مدرستين"], mode: "lenient" });
  assert.equal(gradeQuestion(t, "مدرستين").score, 2);
  assert.equal(gradeQuestion(Q("OPEN", {}, {}), "نص").score, null);
});

test("تصحيح محاولة كاملة: المجموع، المعلّق يدوياً، والدرجة اليدوية، والمهارات", () => {
  const qs = [
    { ...Q("MCQ", { options: ["أ", "ب"] }, { correct: 0 }, 1), id: "a", skillCode: "GRAM.NOMINAL" },
    { ...Q("OPEN", {}, {}, 4), id: "b", skillCode: "WRITE.EXPR" },
    { ...Q("READING_PASSAGE", { passage: "..." }, {}, 0), id: "p" },
  ];
  const r1 = gradeAttempt(qs as any, { a: 0, b: "فقرة" });
  assert.deepEqual([r1.auto, r1.max, r1.pendingManual], [1, 5, 1]);
  const r2 = gradeAttempt(qs as any, { a: 0, b: "فقرة" }, { b: 3 });
  assert.deepEqual([r2.auto, r2.pendingManual], [4, 0]);
  assert.deepEqual(r2.perSkill, { "GRAM.NOMINAL": { got: 1, max: 1 }, "WRITE.EXPR": { got: 3, max: 4 } });
  assert.equal(gradeAttempt(qs as any, {}, { b: 99 }).auto, 4, "اليدوية لا تتجاوز العظمى");
});

test("التحقق من سلامة الأسئلة", () => {
  assert.throws(() => validateQuestion("MCQ", "س", { options: ["أ", "ب"] }, { correct: 3 }));
  assert.throws(() => validateQuestion("MATCHING", "س", { left: ["أ", "ب"], right: ["1", "2"] }, { pairs: [0, 0] }));
  assert.throws(() => validateQuestion("FILL_BLANK", "بلا فراغ", {}, { accepted: ["x"] }));
  assert.throws(() => validateQuestion("ORDER_WORDS", "س", { words: ["أ", "ب"] }, { sentences: [["أ", "ج"]] }));
  assert.equal(validateQuestion("FILL_BLANK", "ذهبت ____ إلى المدرسة", {}, { accepted: ["سارة"] }).answerKey.mode, "lenient");
});

const pool: PoolQuestion[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, type: "MCQ", skillCode: "SPELL.TAA", difficulty: 1 + (i % 2), points: 1, parentId: null, lessonId: `L${i % 3}` })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `g${i}`, type: "TRUE_FALSE", skillCode: "GRAM.NOMINAL", difficulty: 1, points: 1, parentId: null, lessonId: "L9" })),
  { id: "P", type: "READING_PASSAGE", skillCode: "READ.COMP", difficulty: 2, points: 0, parentId: null, lessonId: "L1" },
  { id: "P1", type: "MCQ", skillCode: "READ.COMP", difficulty: 2, points: 1, parentId: "P", lessonId: "L1" },
  { id: "P2", type: "OPEN", skillCode: "READ.COMP", difficulty: 2, points: 2, parentId: "P", lessonId: "L1" },
];

test("المولّد: يحقق جدول المواصفات دون تكرار، وينوّع الدروس، ويُبلغ عن النقص", () => {
  const r = pickQuestions(pool, [{ skillCode: "SPELL.TAA", count: 3 }, { type: "TRUE_FALSE", count: 5 }, { type: "READING_PASSAGE", count: 1 }], 42);
  assert.equal(new Set(r.questionIds).size, r.questionIds.length);
  const taa = r.questionIds.filter((id) => id.startsWith("s"));
  assert.equal(taa.length, 3);
  assert.equal(new Set(taa.map((id) => pool.find((q) => q.id === id)!.lessonId)).size, 3, "من 3 دروس مختلفة");
  assert.deepEqual(r.shortages, [{ row: 1, wanted: 5, found: 3 }]);
  assert.ok(["P", "P1", "P2"].every((id) => r.questionIds.includes(id)), "النص يأتي بأسئلته");
  assert.deepEqual(pickQuestions(pool, [{ skillCode: "SPELL.TAA", count: 3 }], 42), pickQuestions(pool, [{ skillCode: "SPELL.TAA", count: 3 }], 42), "حتمي");
  assert.ok(!pickQuestions(pool, [{ type: "MCQ", count: 20 }], 1).questionIds.includes("P1"), "السؤال الفرعي لا يُختار منفرداً");
});

test("النماذج: النص يبقى مع أسئلته، النموذج أ بالترتيب الأصلي، والخيارات تُخلط حتمياً", () => {
  const ids = ["s0", "s1", "P", "P1", "P2", "g0", "g1"];
  const parentOf = { s0: null, s1: null, P: null, P1: "P", P2: "P", g0: null, g1: null };
  assert.deepEqual(versionOrder(ids, parentOf, 7, 0), ids);
  const b = versionOrder(ids, parentOf, 7, 1);
  assert.equal(new Set(b).size, ids.length);
  const pi = b.indexOf("P");
  assert.deepEqual(b.slice(pi, pi + 3), ["P", "P1", "P2"]);
  assert.notDeepEqual(b, ids);
  assert.deepEqual(permutation(4, 9, "q1"), permutation(4, 9, "q1"));
  assert.deepEqual([...permutation(5, 9, "q1")].sort(), [0, 1, 2, 3, 4]);
  assert.deepEqual([0, 1, 2, 3].map((i) => versionForStudent(i, 3)), [0, 1, 2, 0]);
});

test("المولّد القواعدي: اللام الشمسية/القمرية والتاء والمثنى من الكلمة نفسها", () => {
  assert.equal(lamType("الشَّمس"), "SHAMS");
  assert.equal(lamType("القمر"), "QAMAR");
  assert.equal(lamType("النور"), "SHAMS");
  assert.equal(lamType("الكتاب"), "QAMAR");
  assert.equal(lamType("كتاب"), null);
  assert.equal(taaType("مدرسة"), "MARBUTA");
  assert.equal(taaType("بنت"), "MAFTUHA");
  assert.deepEqual(dualVariants("كتابان"), ["كتابان", "كتابين"]);

  const vocab = ["الشمس", "القمر", "النهر", "الباب", "الزهرة", "الكتاب", "الدرس", "المعلمة"].map((w, i) => ({ id: `v${i}`, word: w }));
  const [d] = generateDrafts("SHAMS_QAMAR", vocab, 1, 3);
  assert.equal(d.type, "CLASSIFY");
  d.payload.items.forEach((w: string, i: number) => assert.equal(d.answerKey.bucketOf[i], lamType(w) === "SHAMS" ? 0 : 1, w));
  validateQuestion(d.type, d.stem, d.payload, d.answerKey);

  const ant = generateDrafts("ANTONYMS", [["طويل", "قصير"], ["كبير", "صغير"], ["فرح", "حزن"], ["نور", "ظلام"]].map(([w, a], i) => ({ id: `a${i}`, word: w, antonym: a })), 1, 5)[0];
  ant.payload.left.forEach((w: string, i: number) => {
    const expected = { طويل: "قصير", كبير: "صغير", فرح: "حزن", نور: "ظلام" }[w];
    assert.equal(ant.payload.right[ant.answerKey.pairs[i]], expected);
  });
  validateQuestion(ant.type, ant.stem, ant.payload, ant.answerKey);
});

import { analyzeItems } from "../src/lib/itemAnalysis";
import { renderVersion } from "../src/lib/renderVersion";

test("تحليل الأسئلة: السهولة والتمييز والأخطاء الشائعة", () => {
  const g = (s: number, max = 1, wrong?: string) => ({ score: s, max, correct: s >= max, ...(wrong ? { wrongAnswer: wrong } : {}) });
  // 8 طالبات: السؤال A يميّز (أجابت عليه المتفوقات فقط)، B سهل للجميع
  const attempts = [10, 9, 8, 7, 4, 3, 2, 1].map((total, i) => ({ total, perQuestion: { A: g(i < 4 ? 1 : 0, 1, i < 4 ? undefined : "مدرسه"), B: g(1) } }));
  const [A, B] = analyzeItems(["A", "B"], attempts);
  assert.equal(A.difficulty, 0.5);
  assert.equal(A.discrimination, 1);
  assert.deepEqual(A.commonWrong, [{ answer: "مدرسه", count: 4 }]);
  assert.equal(B.flag, "TOO_EASY");
  assert.equal(B.discrimination, 0);
  assert.equal(analyzeItems(["B"], attempts.slice(0, 3))[0].flag, null, "لا حكم على عينة صغيرة");
});

test("عرض النموذج للطالبة لا يتضمن مفتاح الإجابة", () => {
  const byId = new Map([
    ["m", { id: "m", type: "MCQ" as const, stem: "س", payload: { options: ["أ", "ب", "ج"] }, answerKey: { correct: 2 }, points: 1, parentId: null }],
    ["o", { id: "o", type: "ORDER_WORDS" as const, stem: "رتبي", payload: { words: ["ذهب", "محمد"] }, answerKey: { sentences: [["ذهب", "محمد"]] }, points: 1, parentId: null }],
  ]);
  const st = renderVersion(["m", "o"], 5, byId, true);
  const json = JSON.stringify(st);
  assert.ok(!/answerKey|correct|sentences/.test(json));
  assert.deepEqual(st[0].options!.map((o) => o.index).sort(), [0, 1, 2]);
  assert.notDeepEqual(st[1].words, ["ذهب", "محمد"], "الكلمات لا تُعرض بالترتيب الصحيح");
  assert.ok(renderVersion(["m"], 5, byId, false)[0].answerKey);
});
