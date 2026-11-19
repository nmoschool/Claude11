/**
 * عرض نموذج اختبار (نقي): ترتيب الأسئلة + خلط الخيارات حتمياً من بذرة النموذج.
 * forStudent=true يحذف مفتاح الإجابة نهائياً من البيانات المرسلة.
 */
import { mulberry32, hashStr, permutation, shuffle } from "@/lib/generator";
import type { QType } from "@/lib/questionTypes";

export interface StoredQuestion {
  id: string;
  type: QType;
  stem: string;
  payload: any;
  answerKey: any;
  points: number;
  parentId: string | null;
  skillCode?: string | null;
  mediaUrl?: string | null;
}

export interface DisplayQuestion {
  id: string;
  number: number | null; // النص القرائي بلا رقم
  type: QType;
  stem: string;
  points: number;
  parentId: string | null;
  passage?: string;
  options?: { index: number; text: string }[]; // MCQ: index = الفهرس الأصلي
  left?: string[];
  right?: { index: number; text: string }[]; // MATCHING
  buckets?: string[];
  items?: { index: number; text: string }[]; // CLASSIFY
  words?: string[]; // ORDER_WORDS (مخلوطة)
  count?: number; // EXTRACT
  source?: string; // TRANSFORM
  say?: string; // DICTATION — نص يُنطق بالصوت (لا يُطبع في ورقة الطالبة)
  lines?: number; // OPEN
  answerKey?: any;
  skillCode?: string | null;
}

export function renderVersion(questionIds: string[], seed: number, byId: Map<string, StoredQuestion>, forStudent: boolean): DisplayQuestion[] {
  let n = 0;
  const out: DisplayQuestion[] = [];
  for (const id of questionIds) {
    const q = byId.get(id);
    if (!q) continue;
    const p = q.payload ?? {};
    const d: DisplayQuestion = {
      id: q.id,
      number: q.type === "READING_PASSAGE" ? null : ++n,
      type: q.type,
      stem: q.stem,
      points: q.points,
      parentId: q.parentId,
      skillCode: q.skillCode,
    };
    switch (q.type) {
      case "READING_PASSAGE":
        d.passage = p.passage;
        break;
      case "MCQ":
        d.options = permutation(p.options.length, seed, id).map((i) => ({ index: i, text: p.options[i] }));
        break;
      case "MATCHING":
        d.left = p.left;
        d.right = permutation(p.right.length, seed, id).map((i) => ({ index: i, text: p.right[i] }));
        break;
      case "CLASSIFY":
        d.buckets = p.buckets;
        d.items = permutation(p.items.length, seed, id).map((i) => ({ index: i, text: p.items[i] }));
        break;
      case "ORDER_WORDS": {
        // خلط مضمون الاختلاف عن الترتيب الصحيح الأول
        let words = shuffle(p.words as string[], mulberry32(seed ^ hashStr(id)));
        const first = q.answerKey?.sentences?.[0]?.join(" ");
        if (words.join(" ") === first && words.length > 1) words = [...words.slice(1), words[0]];
        d.words = words;
        break;
      }
      case "EXTRACT":
        d.passage = p.passage;
        d.count = q.answerKey?.count ?? 1;
        break;
      case "TRANSFORM":
        d.source = p.source;
        break;
      case "DICTATION":
        d.say = p.say;
        break;
      case "OPEN":
        d.lines = p.lines ?? 4;
        break;
    }
    if (!forStudent) d.answerKey = q.answerKey;
    out.push(d);
  }
  return out;
}

/** نص الإجابة الصحيحة للعرض في نموذج الإجابة */
export function answerText(q: DisplayQuestion, raw: StoredQuestion): string {
  const k = raw.answerKey ?? {};
  const p = raw.payload ?? {};
  switch (q.type) {
    case "MCQ": {
      const pos = q.options!.findIndex((o) => o.index === k.correct);
      return `${"أبجدهو"[pos] ?? pos + 1}) ${p.options[k.correct]}`;
    }
    case "TRUE_FALSE":
      return k.correct ? "صواب ✓" : "خطأ ✗";
    case "FILL_BLANK":
    case "TRANSFORM":
    case "DICTATION":
      return k.accepted.join(" / ");
    case "MATCHING":
      return p.left.map((l: string, i: number) => `${l} ← ${p.right[k.pairs[i]]}`).join(" · ");
    case "CLASSIFY":
      return p.buckets.map((b: string, bi: number) => `${b}: ${p.items.filter((_: string, i: number) => k.bucketOf[i] === bi).join("، ")}`).join(" | ");
    case "ORDER_WORDS":
      return k.sentences.map((s: string[]) => s.join(" ")).join(" / أو / ");
    case "EXTRACT":
      return `(${k.count}) من: ${k.accepted.join("، ")}`;
    case "OPEN":
      return k.sample ? `إجابة نموذجية: ${k.sample}${k.rubric ? ` — معيار: ${k.rubric}` : ""}` : k.rubric ?? "تصحيح يدوي";
    default:
      return "";
  }
}
