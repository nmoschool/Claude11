import { z } from "zod";

/**
 * أنواع الأسئلة وبنية بياناتها (payload) ومفتاح إجابتها (answerKey) — آمن للمتصفح.
 * الاستجابة (response) تُرسل دائماً بالفهارس الأصلية للخيارات، فلا يتأثر التصحيح بخلط النماذج.
 */

export const QTYPE_LABELS = {
  MCQ: "اختيار من متعدد",
  TRUE_FALSE: "صواب وخطأ",
  FILL_BLANK: "ملء الفراغ",
  MATCHING: "توصيل",
  CLASSIFY: "تصنيف",
  ORDER_WORDS: "ترتيب كلمات",
  EXTRACT: "استخراج من نص",
  TRANSFORM: "تحويل",
  DICTATION: "إملاء صوتي",
  OPEN: "سؤال مفتوح (تصحيح يدوي)",
  READING_PASSAGE: "نص فهم مقروء",
} as const;
export type QType = keyof typeof QTYPE_LABELS;
export const QTYPES = Object.keys(QTYPE_LABELS) as QType[];

const str = z.string().trim().min(1).max(300);
const mode = z.enum(["spelling", "lenient"]).default("lenient");

export const PayloadSchemas = {
  MCQ: z.object({ options: z.array(str).min(2).max(6) }),
  TRUE_FALSE: z.object({}),
  FILL_BLANK: z.object({}),
  MATCHING: z.object({ left: z.array(str).min(2).max(8), right: z.array(str).min(2).max(10) }),
  CLASSIFY: z.object({ buckets: z.array(str).min(2).max(4), items: z.array(str).min(2).max(12) }),
  ORDER_WORDS: z.object({ words: z.array(str).min(2).max(12) }),
  EXTRACT: z.object({ passage: z.string().trim().min(5).max(3000) }),
  TRANSFORM: z.object({ source: str }),
  DICTATION: z.object({ say: str }),
  OPEN: z.object({ lines: z.number().int().min(1).max(15).default(4) }),
  READING_PASSAGE: z.object({ passage: z.string().trim().min(20).max(6000) }),
} satisfies Record<QType, z.ZodTypeAny>;

export const KeySchemas = {
  MCQ: z.object({ correct: z.number().int().min(0) }),
  TRUE_FALSE: z.object({ correct: z.boolean() }),
  FILL_BLANK: z.object({ accepted: z.array(str).min(1).max(10), mode }),
  MATCHING: z.object({ pairs: z.array(z.number().int().min(0)) }),
  CLASSIFY: z.object({ bucketOf: z.array(z.number().int().min(0)) }),
  ORDER_WORDS: z.object({ sentences: z.array(z.array(str).min(2)).min(1).max(4) }),
  EXTRACT: z.object({ accepted: z.array(str).min(1).max(30), count: z.number().int().min(1).max(10), mode }),
  TRANSFORM: z.object({ accepted: z.array(str).min(1).max(10), mode }),
  DICTATION: z.object({ accepted: z.array(str).min(1).max(5), mode: z.literal("spelling").default("spelling") }),
  OPEN: z.object({ sample: z.string().max(2000).optional(), rubric: z.string().max(2000).optional() }),
  READING_PASSAGE: z.object({}),
} satisfies Record<QType, z.ZodTypeAny>;

/** تحقق متبادل بين البيانات والمفتاح (حدود الفهارس، التطابق في الأطوال...) */
export function validateQuestion(type: QType, stem: string, payload: unknown, key: unknown): { payload: any; answerKey: any } {
  const p = PayloadSchemas[type].parse(payload ?? {}) as any;
  const k = KeySchemas[type].parse(key ?? {}) as any;
  const fail = (m: string) => {
    throw new z.ZodError([{ code: "custom", path: ["answerKey"], message: m, input: key }]);
  };
  if (type === "MCQ" && k.correct >= p.options.length) fail("الإجابة الصحيحة خارج الخيارات");
  if (type === "MATCHING") {
    if (k.pairs.length !== p.left.length) fail("يجب تحديد مطابق لكل عنصر");
    if (k.pairs.some((i: number) => i >= p.right.length)) fail("مطابق غير موجود");
    if (new Set(k.pairs).size !== k.pairs.length) fail("لا يتكرر المطابق");
  }
  if (type === "CLASSIFY") {
    if (k.bucketOf.length !== p.items.length) fail("يجب تحديد مجموعة لكل عنصر");
    if (k.bucketOf.some((i: number) => i >= p.buckets.length)) fail("مجموعة غير موجودة");
  }
  if (type === "ORDER_WORDS") {
    const sorted = (a: string[]) => [...a].sort().join("|");
    if (k.sentences.some((s: string[]) => sorted(s) !== sorted(p.words))) fail("كل ترتيب صحيح يجب أن يستخدم الكلمات نفسها");
  }
  if (type === "FILL_BLANK" && !/_{3,}|\.{3,}|…/.test(stem)) fail("ضعي مكان الفراغ «____» في نص السؤال");
  return { payload: p, answerKey: k };
}

/** الأنواع التي تُصحَّح آلياً بالكامل */
export const AUTO_TYPES: QType[] = ["MCQ", "TRUE_FALSE", "FILL_BLANK", "MATCHING", "CLASSIFY", "ORDER_WORDS", "EXTRACT", "TRANSFORM", "DICTATION"];

/** الأنواع التي يُفضَّل فيها التطبيع المتساهل افتراضياً (ما لم تكن المهارة إملائية) */
export function defaultModeForSkill(skillCode?: string | null): "spelling" | "lenient" {
  return skillCode?.startsWith("SPELL.") ? "spelling" : "lenient";
}
