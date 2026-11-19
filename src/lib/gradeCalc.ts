/**
 * حساب الدرجات (نقي، بلا قاعدة بيانات) — docs/lughati-g4-design.md القسم 2.2
 *
 * القواعد:
 * - درجة المكوّن = (مجموع المحصّل ÷ مجموع العظمى للتقييمات المحتسبة) × وزن المكوّن
 * - «بعذر» (EXCUSED) يُستبعد من البسط والمقام.
 * - «غائبة بلا عذر» (ABSENT) = صفر (قابل للتعطيل: absentAsZero=false يجعلها كالفارغة).
 * - الخلية الفارغة (لم تُرصد) لا تُحتسب.
 * - المجموع = Σ درجات المكوّنات ÷ Σ أوزان المكوّنات المحتسبة × 100
 *   (إعادة التطبيع: مكوّن بلا أي تقييم محتسب لا يُعاقب الطالبة).
 * - completeness = نسبة الأوزان المحتسبة من 100 (مدى اكتمال الرصد).
 */

export type EntryStatus = "NORMAL" | "EXCUSED" | "ABSENT";

export interface CalcItem {
  id: string;
  componentId: string;
  maxScore: number;
  skillIds?: string[];
}
export interface CalcComponent {
  id: string;
  weight: number;
}
export interface CalcEntry {
  itemId: string;
  score: number | null;
  status: EntryStatus;
}
export interface ScaleBand {
  min: number;
  label: string;
}

export const DEFAULT_SCALE: ScaleBand[] = [
  { min: 90, label: "ممتاز" },
  { min: 80, label: "جيد جداً" },
  { min: 70, label: "جيد" },
  { min: 50, label: "مقبول" },
  { min: 0, label: "يحتاج إلى دعم" },
];

export const MASTERY_THRESHOLD = 80; // ٪ للإتقان
export const SUPPORT_THRESHOLD = 60; // ٪ تحتها تُقترح خطة علاجية

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** القيمة المحتسبة لخلية: null = لا تُحتسب */
export function effective(entry: CalcEntry | undefined, absentAsZero = true): number | null {
  if (!entry) return null;
  if (entry.status === "EXCUSED") return null;
  if (entry.status === "ABSENT") return absentAsZero ? 0 : null;
  return entry.score;
}

export interface StudentResult {
  components: Record<string, number | null>; // من وزن المكوّن
  componentPercent: Record<string, number | null>;
  total: number | null; // من 100 بعد التطبيع
  earned: number; // مجموع النقاط المحصلة من الأوزان
  completeness: number; // ٪ من الأوزان المحتسبة
  grade: string | null;
}

export function gradeLabel(total: number | null, scale: ScaleBand[] = DEFAULT_SCALE): string | null {
  if (total === null) return null;
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  return sorted.find((b) => total >= b.min)?.label ?? sorted.at(-1)?.label ?? null;
}

export function studentResult(
  components: CalcComponent[],
  items: CalcItem[],
  entries: CalcEntry[],
  opts: { scale?: ScaleBand[]; absentAsZero?: boolean } = {}
): StudentResult {
  const byItem = new Map(entries.map((e) => [e.itemId, e]));
  const res: StudentResult = { components: {}, componentPercent: {}, total: null, earned: 0, completeness: 0, grade: null };
  let wSum = 0;
  let raw = 0;
  for (const c of components) {
    let got = 0;
    let max = 0;
    for (const it of items.filter((i) => i.componentId === c.id)) {
      const v = effective(byItem.get(it.id), opts.absentAsZero ?? true);
      if (v === null) continue;
      got += v;
      max += it.maxScore;
    }
    if (max === 0) {
      res.components[c.id] = null;
      res.componentPercent[c.id] = null;
      continue;
    }
    const score = round2((got / max) * c.weight);
    res.components[c.id] = score;
    res.componentPercent[c.id] = round2((got / max) * 100);
    wSum += c.weight;
    raw += (got / max) * c.weight;
  }
  if (wSum > 0) {
    res.total = round2((raw / wSum) * 100);
    res.earned = round2(raw);
    res.completeness = round2(wSum);
    res.grade = gradeLabel(res.total, opts.scale);
  }
  return res;
}

export interface Stats {
  count: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  /** ٪ الطالبات اللاتي بلغن عتبة الإتقان */
  mastery: number | null;
  /** ٪ الطالبات تحت عتبة الدعم */
  needSupport: number | null;
}

/** إحصاءات لقائمة نسب مئوية (0–100) */
export function stats(values: (number | null | undefined)[]): Stats {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { count: 0, mean: null, median: null, sd: null, min: null, max: null, mastery: null, needSupport: null };
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const median = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return {
    count: n,
    mean: round2(mean),
    median: round2(median),
    sd: round2(sd),
    min: v[0],
    max: v[n - 1],
    mastery: round2((v.filter((x) => x >= MASTERY_THRESHOLD).length / n) * 100),
    needSupport: round2((v.filter((x) => x < SUPPORT_THRESHOLD).length / n) * 100),
  };
}

/** نسبة الدرجة في تقييم واحد (٪) أو null */
export function itemPercent(entry: CalcEntry | undefined, maxScore: number, absentAsZero = true): number | null {
  const v = effective(entry, absentAsZero);
  return v === null || maxScore <= 0 ? null : round2((v / maxScore) * 100);
}

/**
 * الإتقان المهاري: لكل مهارة، مجموع المحصّل ÷ مجموع العظمى في كل التقييمات الموسومة بها.
 * التقييم الموسوم بعدة مهارات يُحتسب لكل منها.
 */
export function skillMastery(items: CalcItem[], entries: CalcEntry[], absentAsZero = true): Record<string, number> {
  const byItem = new Map(entries.map((e) => [e.itemId, e]));
  const acc = new Map<string, { got: number; max: number }>();
  for (const it of items) {
    const v = effective(byItem.get(it.id), absentAsZero);
    if (v === null) continue;
    for (const s of it.skillIds ?? []) {
      const a = acc.get(s) ?? { got: 0, max: 0 };
      a.got += v;
      a.max += it.maxScore;
      acc.set(s, a);
    }
  }
  return Object.fromEntries(Array.from(acc, ([k, a]) => [k, round2((a.got / a.max) * 100)]));
}

export function validateWeights(weights: number[]): string | null {
  if (!weights.length) return "يجب تعريف مكوّن واحد على الأقل";
  if (weights.some((w) => !(w > 0))) return "كل وزن يجب أن يكون أكبر من صفر";
  const sum = round2(weights.reduce((s, w) => s + w, 0));
  return sum === 100 ? null : `مجموع الأوزان ${sum} ويجب أن يساوي 100`;
}

/** يقرأ إدخال خلية من المعلمة: رقم (عربي أو لاتيني)، «غ» غائبة، «ع» بعذر، فارغ = مسح */
export function parseCellInput(raw: string, max: number): { score: number | null; status: EntryStatus } | { error: string } {
  const s = raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace("٫", ".").replace(",", ".");
  if (!s) return { score: null, status: "NORMAL" };
  if (["غ", "غائبة", "a", "A"].includes(s)) return { score: null, status: "ABSENT" };
  if (["ع", "عذر", "بعذر", "e", "E"].includes(s)) return { score: null, status: "EXCUSED" };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { error: "أدخلي رقماً أو «غ» للغياب أو «ع» للعذر" };
  const n = Number(s);
  if (n > max) return { error: `الدرجة أكبر من العظمى (${max})` };
  return { score: n, status: "NORMAL" };
}
