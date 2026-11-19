/**
 * مولّد قواعدي لأسئلة من قاموس مفردات المنهج (نقي، حتمي ببذرة).
 * الأسئلة الناتجة «مسودات» تعرضها المنصة للمعلمة قبل حفظها في البنك.
 */
import { mulberry32, shuffle } from "@/lib/generator";

export interface Vocab {
  id: string;
  word: string;
  meaning?: string | null;
  antonym?: string | null;
  plural?: string | null;
  dual?: string | null;
  lessonId?: string | null;
}

export interface Draft {
  type: "MCQ" | "CLASSIFY" | "MATCHING" | "TRANSFORM";
  skillCode: string;
  stem: string;
  payload: any;
  answerKey: any;
  points: number;
  difficulty: number;
  lessonId?: string | null;
}

export const GENERATOR_KINDS = {
  SHAMS_QAMAR: "اللام الشمسية والقمرية (تصنيف)",
  TAA: "التاء المربوطة والمفتوحة (تصنيف)",
  DUAL: "التحويل إلى المثنى",
  PLURAL: "التحويل إلى الجمع",
  ANTONYMS: "توصيل الأضداد",
  MEANINGS: "معاني المفردات (اختيار من متعدد)",
} as const;
export type GeneratorKind = keyof typeof GENERATOR_KINDS;

/** الحروف الشمسية: ت ث د ذ ر ز س ش ص ض ط ظ ل ن */
const SUN = new Set("تثدذرزسشصضطظلن");
const strip = (w: string) => w.replace(/[ً-ْٰـ]/g, "").trim();

export function lamType(word: string): "SHAMS" | "QAMAR" | null {
  const w = strip(word);
  if (!/^ال./.test(w)) return null;
  return SUN.has(w[2]) ? "SHAMS" : "QAMAR";
}

export function taaType(word: string): "MARBUTA" | "MAFTUHA" | null {
  const w = strip(word);
  if (w.endsWith("ة")) return "MARBUTA";
  if (w.endsWith("ت")) return "MAFTUHA";
  return null;
}

/** صيغة المثنى الأخرى (رفع/نصب): كتابان ⇄ كتابين */
export function dualVariants(dual: string): string[] {
  const d = strip(dual);
  if (d.endsWith("ان")) return [d, d.slice(0, -2) + "ين"];
  if (d.endsWith("ين")) return [d, d.slice(0, -2) + "ان"];
  return [d];
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i + n <= a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

export function generateDrafts(kind: GeneratorKind, vocab: Vocab[], count: number, seed = 1): Draft[] {
  const rnd = mulberry32(seed);
  const v = shuffle(vocab, rnd);
  const drafts: Draft[] = [];

  if (kind === "SHAMS_QAMAR") {
    const words = v.filter((x) => lamType(x.word));
    const shams = words.filter((x) => lamType(x.word) === "SHAMS");
    const qamar = words.filter((x) => lamType(x.word) === "QAMAR");
    for (let i = 0; i < count; i++) {
      const items = shuffle([...shams.slice(i * 3, i * 3 + 3), ...qamar.slice(i * 3, i * 3 + 3)], rnd);
      if (items.length < 4 || !items.some((x) => lamType(x.word) === "SHAMS") || !items.some((x) => lamType(x.word) === "QAMAR")) break;
      drafts.push({
        type: "CLASSIFY",
        skillCode: "SPELL.SHAMS_QAMAR",
        stem: "صنّفي الكلمات الآتية حسب نوع اللام:",
        payload: { buckets: ["لام شمسية", "لام قمرية"], items: items.map((x) => strip(x.word)) },
        answerKey: { bucketOf: items.map((x) => (lamType(x.word) === "SHAMS" ? 0 : 1)) },
        points: items.length / 2,
        difficulty: 1,
        lessonId: items[0].lessonId,
      });
    }
  }

  if (kind === "TAA") {
    const words = v.filter((x) => taaType(x.word));
    const m = words.filter((x) => taaType(x.word) === "MARBUTA");
    const f = words.filter((x) => taaType(x.word) === "MAFTUHA");
    for (let i = 0; i < count; i++) {
      const items = shuffle([...m.slice(i * 3, i * 3 + 3), ...f.slice(i * 3, i * 3 + 3)], rnd);
      if (items.length < 4 || !items.some((x) => taaType(x.word) === "MARBUTA") || !items.some((x) => taaType(x.word) === "MAFTUHA")) break;
      drafts.push({
        type: "CLASSIFY",
        skillCode: "SPELL.TAA",
        stem: "صنّفي الكلمات الآتية حسب نوع التاء في آخرها:",
        payload: { buckets: ["تاء مربوطة", "تاء مفتوحة"], items: items.map((x) => strip(x.word)) },
        answerKey: { bucketOf: items.map((x) => (taaType(x.word) === "MARBUTA" ? 0 : 1)) },
        points: items.length / 2,
        difficulty: 1,
        lessonId: items[0].lessonId,
      });
    }
  }

  if (kind === "DUAL" || kind === "PLURAL") {
    const field = kind === "DUAL" ? "dual" : "plural";
    for (const x of v.filter((y) => y[field]).slice(0, count)) {
      drafts.push({
        type: "TRANSFORM",
        skillCode: "LEX.NUMBER",
        stem: `حوّلي كلمة «${strip(x.word)}» إلى ${kind === "DUAL" ? "المثنى" : "الجمع"}:`,
        payload: { source: strip(x.word) },
        answerKey: { accepted: kind === "DUAL" ? dualVariants(x.dual!) : strip(x.plural!).split(/[،,]/).map((s) => s.trim()).filter(Boolean), mode: "lenient" },
        points: 1,
        difficulty: kind === "DUAL" ? 1 : 2,
        lessonId: x.lessonId,
      });
    }
  }

  if (kind === "ANTONYMS") {
    for (const group of chunk(v.filter((x) => x.antonym), 4).slice(0, count)) {
      const order = shuffle(group.map((_, i) => i), rnd);
      drafts.push({
        type: "MATCHING",
        skillCode: "READ.COMP",
        stem: "صِلي كل كلمة بضدّها:",
        payload: { left: group.map((x) => strip(x.word)), right: order.map((i) => strip(group[i].antonym!)) },
        answerKey: { pairs: group.map((_, i) => order.indexOf(i)) },
        points: group.length / 2,
        difficulty: 1,
        lessonId: group[0].lessonId,
      });
    }
  }

  if (kind === "MEANINGS") {
    const withMeaning = v.filter((x) => x.meaning);
    for (const x of withMeaning.slice(0, count)) {
      const distractors = shuffle(withMeaning.filter((y) => y.id !== x.id && y.meaning !== x.meaning), rnd).slice(0, 3);
      if (distractors.length < 2) break;
      const options = shuffle([x.meaning!, ...distractors.map((d) => d.meaning!)], rnd);
      drafts.push({
        type: "MCQ",
        skillCode: "READ.COMP",
        stem: `معنى كلمة «${strip(x.word)}»:`,
        payload: { options },
        answerKey: { correct: options.indexOf(x.meaning!) },
        points: 1,
        difficulty: 2,
        lessonId: x.lessonId,
      });
    }
  }
  return drafts;
}
