/**
 * كتالوج الألعاب وبناء الجولات (نقي، آمن للمتصفح، يعمل دون اتصال).
 * الصعوبة تكيفية: 3 إجابات صحيحة متتالية ← مستوى أعلى؛ خطآن متتاليان ← مستوى أسهل.
 */
import { lamType, taaType } from "@/lib/vocabGenerators";
import { mulberry32, shuffle } from "@/lib/generator";

export interface GameContent {
  alWords: { ref: string; word: string }[];
  taaWords: { ref: string; word: string }[];
  numberWords: { ref: string; word: string; dual: string; plural: string }[];
  antonyms: { ref: string; a: string; b: string }[];
  sentences: { ref: string; orders: string[][] }[];
  dictation: { ref: string; word: string; level: 1 | 2 | 3 }[];
}

export const GAMES = {
  SHAMS_GARDEN: { title: "حديقة الشمس والقمر", icon: "🌻", skill: "SPELL.SHAMS_QAMAR", color: "from-amber-300 to-orange-500", desc: "ضعي الكلمة في زهرة الشمس أو زهرة القمر" },
  SENTENCE_TRAIN: { title: "قطار الجملة", icon: "🚂", skill: "GRAM.VERBAL", color: "from-sky-400 to-brand-600", desc: "رتّبي عربات الكلمات لتكوّني جملة مفيدة" },
  TAA_CATCHER: { title: "صائدة التاء", icon: "🎣", skill: "SPELL.TAA", color: "from-accent-400 to-accent-600", desc: "أكملي الكلمة بالتاء المناسبة" },
  NUMBER_FACTORY: { title: "مصنع المفرد والمثنى والجمع", icon: "🏭", skill: "LEX.NUMBER", color: "from-mint-500 to-mint-700", desc: "اختاري الصيغة الصحيحة" },
  MEMORY_CARDS: { title: "بطاقات الأضداد", icon: "🃏", skill: "READ.COMP", color: "from-violet-400 to-violet-700", desc: "اقلبي البطاقات وطابقي كل كلمة بضدّها" },
  ECHO_DICTATION: { title: "إملاء الصدى", icon: "🔊", skill: "SPELL.HAMZA_START", color: "from-lime-400 to-emerald-600", desc: "استمعي للكلمة واكتبيها" },
} as const;
export type GameCode = keyof typeof GAMES;
export const GAME_CODES = Object.keys(GAMES) as GameCode[];
export const ROUNDS_PER_SESSION = 10;

export type Round =
  | { kind: "choice"; ref: string; skill: string; prompt: string; sub?: string; choices: string[]; answer: number; timer?: number; display?: "word" | "pair" }
  | { kind: "order"; ref: string; skill: string; prompt: string; words: string[]; orders: string[][] }
  | { kind: "type"; ref: string; skill: string; prompt: string; say: string; answer: string }
  | { kind: "memory"; ref: string; skill: string; prompt: string; pairs: { ref: string; a: string; b: string }[] };

const pick = <T,>(xs: T[], rnd: () => number, avoid: Set<string>, key: (x: T) => string): T | undefined => {
  const fresh = xs.filter((x) => !avoid.has(key(x)));
  const pool = fresh.length ? fresh : xs;
  return pool[Math.floor(rnd() * pool.length)];
};

export function buildRound(code: GameCode, c: GameContent, level: 1 | 2 | 3, seed: number, recent: Set<string>): Round | null {
  const rnd = mulberry32(seed);
  switch (code) {
    case "SHAMS_GARDEN": {
      const w = pick(c.alWords.filter((x) => lamType(x.word)), rnd, recent, (x) => x.ref);
      if (!w) return null;
      return {
        kind: "choice",
        ref: w.ref,
        skill: "SPELL.SHAMS_QAMAR",
        prompt: w.word,
        sub: "في أيّ زهرة تضعين هذه الكلمة؟",
        choices: ["🌞 لام شمسية", "🌙 لام قمرية"],
        answer: lamType(w.word) === "SHAMS" ? 0 : 1,
        timer: level === 1 ? undefined : level === 2 ? 10 : 6,
        display: "word",
      };
    }
    case "TAA_CATCHER": {
      const w = pick(c.taaWords.filter((x) => taaType(x.word)), rnd, recent, (x) => x.ref);
      if (!w) return null;
      const clean = w.word.replace(/[ً-ْ]/g, "");
      const marb = taaType(clean) === "MARBUTA";
      const choices = level === 1 ? ["ـة", "ـت"] : ["ـة", "ـت", "ـه"];
      return {
        kind: "choice",
        ref: w.ref,
        skill: "SPELL.TAA",
        prompt: clean.slice(0, -1) + "ـ؟",
        sub: "أكملي الكلمة بالحرف المناسب",
        choices,
        answer: marb ? 0 : 1,
        timer: level === 3 ? 7 : undefined,
        display: "word",
      };
    }
    case "NUMBER_FACTORY": {
      const w = pick(c.numberWords, rnd, recent, (x) => x.ref);
      if (!w) return null;
      const target: "dual" | "plural" = level === 1 ? "dual" : level === 2 ? "plural" : rnd() < 0.5 ? "dual" : "plural";
      const correct = w[target];
      // مشتّتات: الصيغة الأخرى + خطأ شائع (إلحاق «ان» دون قلب التاء المربوطة) + صيغة كلمة أخرى
      const naive = w.word + "ان";
      const other = c.numberWords.find((x) => x.ref !== w.ref)?.[target];
      const distractors = Array.from(new Set([target === "dual" ? w.plural : w.dual, naive, w.word + "ات", other].filter((x): x is string => !!x && x !== correct)));
      const choices = shuffle([correct, ...distractors.slice(0, level === 3 ? 3 : 2)], rnd);
      return { kind: "choice", ref: w.ref + ":" + target, skill: "LEX.NUMBER", prompt: w.word, sub: target === "dual" ? "ما المثنى؟" : "ما الجمع؟", choices, answer: choices.indexOf(correct), display: "word" };
    }
    case "SENTENCE_TRAIN": {
      const maxWords = level === 1 ? 3 : level === 2 ? 4 : 99;
      const fit = c.sentences.filter((s) => s.orders[0].length <= maxWords);
      const s = pick(fit.length ? fit : c.sentences, rnd, recent, (x) => x.ref);
      if (!s) return null;
      let words = shuffle(s.orders[0], rnd);
      if (s.orders.some((o) => o.join(" ") === words.join(" ")) && words.length > 1) words = [...words.slice(1), words[0]];
      return { kind: "order", ref: s.ref, skill: "GRAM.VERBAL", prompt: "رتّبي العربات لتكوّني جملة مفيدة", words, orders: s.orders };
    }
    case "MEMORY_CARDS": {
      const n = level === 1 ? 3 : level === 2 ? 4 : 6;
      const pairs = shuffle(c.antonyms, rnd).slice(0, n);
      if (pairs.length < 2) return null;
      return { kind: "memory", ref: "board", skill: "READ.COMP", prompt: "اقلبي بطاقتين: الكلمة وضدّها", pairs };
    }
    case "ECHO_DICTATION": {
      const pool = c.dictation.filter((d) => d.level === level);
      const w = pick(pool.length ? pool : c.dictation, rnd, recent, (x) => x.ref);
      if (!w) return null;
      return { kind: "type", ref: w.ref, skill: w.level === 3 ? "SPELL.HAMZA_START" : w.level === 2 ? "SPELL.TAA" : "HAND.NASKH", prompt: "استمعي ثم اكتبي الكلمة", say: w.word, answer: w.word };
    }
  }
}

/** المستوى التالي حسب آخر النتائج: 3 صحيحة متتالية ← أعلى، خطآن متتاليان ← أسهل */
export function adaptLevel(level: 1 | 2 | 3, history: boolean[]): 1 | 2 | 3 {
  const last = history.slice(-3);
  if (last.length === 3 && last.every(Boolean) && level < 3) return (level + 1) as 2 | 3;
  const last2 = history.slice(-2);
  if (last2.length === 2 && last2.every((x) => !x) && level > 1) return (level - 1) as 1 | 2;
  return level;
}

/** تلميح للجولة: يحذف خياراً خاطئاً / يضع الكلمة الأولى / يُظهر الحرف الأول */
export function hintFor(r: Round, removed: number[] = []): { removeChoice?: number; firstWord?: string; firstLetter?: string } {
  if (r.kind === "choice") {
    const wrong = r.choices.map((_, i) => i).filter((i) => i !== r.answer && !removed.includes(i));
    return wrong.length > 1 ? { removeChoice: wrong[0] } : {};
  }
  if (r.kind === "order") return { firstWord: r.orders[0][0] };
  if (r.kind === "type") return { firstLetter: r.answer[0] };
  return {};
}
