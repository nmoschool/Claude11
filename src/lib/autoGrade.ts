import { matchesAny, normalizeAr } from "@/lib/arabicNormalize";
import type { QType } from "@/lib/questionTypes";

/** تصحيح سؤال واحد (نقي) — الدرجة الجزئية للتوصيل والتصنيف والاستخراج */

export interface GradableQuestion {
  id: string;
  type: QType;
  points: number;
  payload: any;
  answerKey: any;
}

export interface GradeOutcome {
  score: number | null; // null = يحتاج تصحيحاً يدوياً
  max: number;
  correct: boolean | null;
  /** للتحليل: الإجابة الخاطئة بعد التطبيع (لاستخراج الأخطاء الشائعة) */
  wrongAnswer?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function gradeQuestion(q: GradableQuestion, response: unknown): GradeOutcome {
  const max = q.points;
  const k = q.answerKey ?? {};
  const out = (fraction: number, wrong?: string): GradeOutcome => ({
    score: r2(Math.max(0, Math.min(1, fraction)) * max),
    max,
    correct: fraction >= 1,
    ...(fraction < 1 && wrong ? { wrongAnswer: wrong.slice(0, 80) } : {}),
  });
  const empty = response === undefined || response === null || response === "" || (Array.isArray(response) && response.every((x) => x === null || x === "" || x === undefined));

  switch (q.type) {
    case "READING_PASSAGE":
      return { score: 0, max: 0, correct: null };
    case "OPEN":
      return { score: null, max, correct: null };
  }
  if (empty) return out(0);

  switch (q.type) {
    case "MCQ":
      return out(response === k.correct ? 1 : 0, q.payload.options?.[response as number]);
    case "TRUE_FALSE":
      return out(response === k.correct ? 1 : 0, response ? "صواب" : "خطأ");
    case "FILL_BLANK":
    case "TRANSFORM":
    case "DICTATION":
      return out(matchesAny(String(response), k.accepted, k.mode ?? "lenient") ? 1 : 0, normalizeAr(String(response), "spelling"));
    case "MATCHING": {
      const res = response as (number | null)[];
      const ok = k.pairs.filter((p: number, i: number) => res[i] === p).length;
      return out(ok / k.pairs.length);
    }
    case "CLASSIFY": {
      const res = response as (number | null)[];
      const ok = k.bucketOf.filter((b: number, i: number) => res[i] === b).length;
      return out(ok / k.bucketOf.length);
    }
    case "ORDER_WORDS": {
      const ans = normalizeAr((response as string[]).join(" "), "lenient");
      const ok = k.sentences.some((s: string[]) => normalizeAr(s.join(" "), "lenient") === ans);
      return out(ok ? 1 : 0, ans);
    }
    case "EXTRACT": {
      // كل كلمة صحيحة ومختلفة تُحتسب، حتى «count»
      const seen = new Set<string>();
      let ok = 0;
      for (const w of response as string[]) {
        const n = normalizeAr(w ?? "", k.mode ?? "lenient");
        if (!n || seen.has(n)) continue;
        seen.add(n);
        if (matchesAny(w, k.accepted, k.mode ?? "lenient")) ok++;
      }
      return out(Math.min(ok, k.count) / k.count);
    }
  }
  return { score: null, max, correct: null };
}

export interface AttemptScore {
  auto: number;
  max: number;
  pendingManual: number; // عدد الأسئلة بانتظار التصحيح اليدوي
  perQuestion: Record<string, GradeOutcome>;
  perSkill: Record<string, { got: number; max: number }>;
}

export function gradeAttempt(
  questions: (GradableQuestion & { skillCode?: string | null })[],
  answers: Record<string, unknown>,
  manual: Record<string, number> = {}
): AttemptScore {
  const res: AttemptScore = { auto: 0, max: 0, pendingManual: 0, perQuestion: {}, perSkill: {} };
  for (const q of questions) {
    if (q.type === "READING_PASSAGE") continue;
    let g = gradeQuestion(q, answers[q.id]);
    if (g.score === null && typeof manual[q.id] === "number") {
      const s = Math.max(0, Math.min(q.points, manual[q.id]));
      g = { score: s, max: q.points, correct: s >= q.points };
    }
    res.perQuestion[q.id] = g;
    res.max += g.max;
    if (g.score === null) res.pendingManual++;
    else res.auto += g.score;
    if (q.skillCode && g.score !== null) {
      const s = res.perSkill[q.skillCode] ?? { got: 0, max: 0 };
      s.got += g.score;
      s.max += g.max;
      res.perSkill[q.skillCode] = s;
    }
  }
  res.auto = r2(res.auto);
  return res;
}
