/**
 * 20 حالة حساب محسوبة يدوياً (معيار القبول للمرحلة 3: مطابقة 100%).
 * المكوّنات الافتراضية: مشاركة 10، واجبات 10، أداء 20، قصير 20، فتري 10، نهائي 30.
 * كل حالة موثّقة بخطوات الحساب اليدوي في التعليق.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  studentResult,
  stats,
  skillMastery,
  gradeLabel,
  validateWeights,
  parseCellInput,
  type CalcComponent,
  type CalcItem,
  type CalcEntry,
} from "../src/lib/gradeCalc";

const C: CalcComponent[] = [
  { id: "PART", weight: 10 },
  { id: "HW", weight: 10 },
  { id: "PERF", weight: 20 },
  { id: "QUIZ", weight: 20 },
  { id: "MID", weight: 10 },
  { id: "FIN", weight: 30 },
];
const I: CalcItem[] = [
  { id: "p1", componentId: "PART", maxScore: 5, skillIds: ["SPEAK"] },
  { id: "h1", componentId: "HW", maxScore: 10 },
  { id: "h2", componentId: "HW", maxScore: 10 },
  { id: "pf1", componentId: "PERF", maxScore: 20, skillIds: ["READ.ALOUD"] },
  { id: "q1", componentId: "QUIZ", maxScore: 10, skillIds: ["SPELL.TAA"] },
  { id: "q2", componentId: "QUIZ", maxScore: 20, skillIds: ["SPELL.TAA", "GRAM.NOMINAL"] },
  { id: "m1", componentId: "MID", maxScore: 40 },
  { id: "f1", componentId: "FIN", maxScore: 60 },
];
const N = (itemId: string, score: number): CalcEntry => ({ itemId, score, status: "NORMAL" });
const AB = (itemId: string): CalcEntry => ({ itemId, score: null, status: "ABSENT" });
const EX = (itemId: string): CalcEntry => ({ itemId, score: null, status: "EXCUSED" });
const full = (scores: Record<string, number>) => Object.entries(scores).map(([k, v]) => N(k, v));

test("1) العلامة الكاملة في كل شيء = 100 ممتاز", () => {
  const r = studentResult(C, I, full({ p1: 5, h1: 10, h2: 10, pf1: 20, q1: 10, q2: 20, m1: 40, f1: 60 }));
  assert.equal(r.total, 100);
  assert.equal(r.grade, "ممتاز");
  assert.equal(r.completeness, 100);
});

test("2) صفر في كل شيء = 0 يحتاج إلى دعم", () => {
  const r = studentResult(C, I, full({ p1: 0, h1: 0, h2: 0, pf1: 0, q1: 0, q2: 0, m1: 0, f1: 0 }));
  assert.equal(r.total, 0);
  assert.equal(r.grade, "يحتاج إلى دعم");
});

test("3) حالة نموذجية كاملة", () => {
  // مشاركة 4/5×10=8 | واجبات 17/20×10=8.5 | أداء 15/20×20=15 | قصير 24/30×20=16 | فتري 30/40×10=7.5 | نهائي 48/60×30=24
  // المجموع 79 ⇒ جيد
  const r = studentResult(C, I, full({ p1: 4, h1: 9, h2: 8, pf1: 15, q1: 8, q2: 16, m1: 30, f1: 48 }));
  assert.deepEqual(r.components, { PART: 8, HW: 8.5, PERF: 15, QUIZ: 16, MID: 7.5, FIN: 24 });
  assert.equal(r.total, 79);
  assert.equal(r.grade, "جيد");
});

test("4) الغياب بعذر يُستبعد من المقام", () => {
  // واجبات: h1=8، h2 بعذر ⇒ 8/10×10 = 8 (وليس 8/20×10 = 4)
  const r = studentResult(C, I, [N("h1", 8), EX("h2")]);
  assert.equal(r.components.HW, 8);
  // مكوّن واحد فقط محتسب ⇒ المجموع = 8/10×100 = 80
  assert.equal(r.total, 80);
  assert.equal(r.completeness, 10);
});

test("5) الغياب بلا عذر = صفر", () => {
  // واجبات: h1=8، h2 غائبة ⇒ 8/20×10 = 4
  const r = studentResult(C, I, [N("h1", 8), AB("h2")]);
  assert.equal(r.components.HW, 4);
  assert.equal(r.total, 40);
});

test("6) الغياب بلا عذر مع تعطيل «صفر للغياب» يُعامل كفارغ", () => {
  const r = studentResult(C, I, [N("h1", 8), AB("h2")], { absentAsZero: false });
  assert.equal(r.components.HW, 8);
});

test("7) مكوّن كله بعذر لا يُحتسب ويُعاد التطبيع", () => {
  // فتري بعذر، والباقي كامل ⇒ 90/90 = 100
  const r = studentResult(C, I, [...full({ p1: 5, h1: 10, h2: 10, pf1: 20, q1: 10, q2: 20, f1: 60 }), EX("m1")]);
  assert.equal(r.components.MID, null);
  assert.equal(r.total, 100);
  assert.equal(r.completeness, 90);
});

test("8) لا توجد أي درجات = null", () => {
  const r = studentResult(C, I, []);
  assert.equal(r.total, null);
  assert.equal(r.grade, null);
  assert.equal(r.completeness, 0);
});

test("9) التجميع (pooled) وليس متوسط النسب", () => {
  // قصير: q1=10/10، q2=0/20 ⇒ 10/30×20 = 6.67 (متوسط النسب كان سيعطي 10)
  const r = studentResult(C, I, [N("q1", 10), N("q2", 0)]);
  assert.equal(r.components.QUIZ, 6.67);
});

test("10) درجات عشرية", () => {
  // أداء 17.5/20×20 = 17.5 ⇒ المجموع 87.5 جيد جداً
  const r = studentResult(C, I, [N("pf1", 17.5)]);
  assert.equal(r.components.PERF, 17.5);
  assert.equal(r.total, 87.5);
  assert.equal(r.grade, "جيد جداً");
});

test("11) التقريب لرقمين عشريين", () => {
  // واجبات 7/20... h1=3، h2=4 ⇒ 7/20×10 = 3.5 | قصير q1=7 ⇒ 7/10×20 = 14
  // المجموع = (3.5+14)/(10+20)×100 = 58.333.. ⇒ 58.33
  const r = studentResult(C, I, [N("h1", 3), N("h2", 4), N("q1", 7)]);
  assert.equal(r.total, 58.33);
  assert.equal(r.earned, 17.5);
});

test("12) حدود سلم التقدير", () => {
  assert.equal(gradeLabel(90), "ممتاز");
  assert.equal(gradeLabel(89.99), "جيد جداً");
  assert.equal(gradeLabel(80), "جيد جداً");
  assert.equal(gradeLabel(70), "جيد");
  assert.equal(gradeLabel(69.99), "مقبول");
  assert.equal(gradeLabel(50), "مقبول");
  assert.equal(gradeLabel(49.99), "يحتاج إلى دعم");
});

test("13) سلم تقدير مخصّص", () => {
  assert.equal(gradeLabel(85, [{ min: 0, label: "ب" }, { min: 85, label: "أ" }]), "أ");
});

test("14) أوزان مخصّصة (50/50)", () => {
  const c = [{ id: "QUIZ", weight: 50 }, { id: "FIN", weight: 50 }];
  // 15/30×50 = 25 | 45/60×50 = 37.5 ⇒ 62.5
  const r = studentResult(c, I, [N("q1", 5), N("q2", 10), N("f1", 45)]);
  assert.equal(r.total, 62.5);
});

test("15) مكوّن بلا تقييمات معرّفة لا يُحتسب", () => {
  const r = studentResult([...C, { id: "EMPTY", weight: 5 }], I, [N("f1", 30)]);
  assert.equal(r.components.EMPTY, null);
  assert.equal(r.total, 50);
});

test("16) الإحصاءات: متوسط ووسيط وانحراف وإتقان ودعم", () => {
  // [40, 60, 80, 100]: المتوسط 70، الوسيط 70، الانحراف √(900+100+100+900)/4 = √500 = 22.36
  // إتقان (≥80): 2/4 = 50٪، دعم (<60): 1/4 = 25٪
  const s = stats([40, 60, 80, 100, null]);
  assert.deepEqual(s, { count: 4, mean: 70, median: 70, sd: 22.36, min: 40, max: 100, mastery: 50, needSupport: 25 });
});

test("17) الإحصاءات: عدد فردي وقائمة فارغة", () => {
  assert.equal(stats([90, 10, 50]).median, 50);
  assert.equal(stats([]).mean, null);
});

test("18) الإتقان المهاري يجمع التقييمات الموسومة بالمهارة", () => {
  // SPELL.TAA: q1 8/10 + q2 12/20 ⇒ 20/30 = 66.67 | GRAM.NOMINAL: q2 12/20 = 60 | SPEAK: p1 بعذر ⇒ غير موجود
  const m = skillMastery(I, [N("q1", 8), N("q2", 12), EX("p1"), N("pf1", 18)]);
  assert.deepEqual(m, { "SPELL.TAA": 66.67, "GRAM.NOMINAL": 60, "READ.ALOUD": 90 });
});

test("19) التحقق من الأوزان", () => {
  assert.equal(validateWeights([10, 10, 20, 20, 10, 30]), null);
  assert.match(validateWeights([10, 10, 20])!, /40/);
  assert.match(validateWeights([0, 100])!, /أكبر من صفر/);
  assert.equal(validateWeights([33.33, 33.33, 33.34]), null);
});

test("20) إدخال الخلية: أرقام عربية، غياب، عذر، تجاوز العظمى", () => {
  assert.deepEqual(parseCellInput("١٧٫٥", 20), { score: 17.5, status: "NORMAL" });
  assert.deepEqual(parseCellInput("غ", 20), { score: null, status: "ABSENT" });
  assert.deepEqual(parseCellInput("ع", 20), { score: null, status: "EXCUSED" });
  assert.deepEqual(parseCellInput("", 20), { score: null, status: "NORMAL" });
  assert.ok("error" in parseCellInput("21", 20));
  assert.ok("error" in parseCellInput("-3", 20));
  assert.ok("error" in parseCellInput("abc", 20));
});
