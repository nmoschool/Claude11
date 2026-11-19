/**
 * تحليل الاختبار (نقي): لكل سؤال
 * - معامل السهولة p = متوسط (الدرجة ÷ العظمى)
 * - معامل التمييز D = p(أعلى 27٪) − p(أدنى 27٪)
 * - أكثر الإجابات الخاطئة شيوعاً
 */
import type { GradeOutcome } from "@/lib/autoGrade";

export interface AnalyzedAttempt {
  total: number;
  perQuestion: Record<string, GradeOutcome>;
}

export interface ItemStat {
  questionId: string;
  answered: number;
  difficulty: number | null; // 0..1 (أعلى = أسهل)
  discrimination: number | null; // -1..1
  commonWrong: { answer: string; count: number }[];
  flag: "TOO_EASY" | "TOO_HARD" | "POOR_DISCRIMINATION" | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
export const MIN_SAMPLE = 5;

export function analyzeItems(questionIds: string[], attempts: AnalyzedAttempt[]): ItemStat[] {
  const sorted = [...attempts].sort((a, b) => b.total - a.total);
  const k = Math.max(1, Math.round(sorted.length * 0.27));
  const upper = sorted.slice(0, k);
  const lower = sorted.slice(-k);
  const pOf = (group: AnalyzedAttempt[], id: string) => {
    const xs = group.map((a) => a.perQuestion[id]).filter((g) => g && g.score !== null && g.max > 0);
    return xs.length ? xs.reduce((s, g) => s + g!.score! / g!.max, 0) / xs.length : null;
  };
  return questionIds.map((id) => {
    const p = pOf(attempts, id);
    const pu = pOf(upper, id);
    const pl = pOf(lower, id);
    const d = pu !== null && pl !== null && sorted.length >= 4 ? r2(pu - pl) : null;
    const wrong = new Map<string, number>();
    attempts.forEach((a) => {
      const w = a.perQuestion[id]?.wrongAnswer;
      if (w) wrong.set(w, (wrong.get(w) ?? 0) + 1);
    });
    // لا أحكام على السؤال قبل 5 محاولات على الأقل (عينة صغيرة مضللة)
    const answered = attempts.filter((a) => a.perQuestion[id]?.score != null).length;
    const flag = p === null || answered < MIN_SAMPLE ? null : p >= 0.9 ? "TOO_EASY" : p <= 0.25 ? "TOO_HARD" : d !== null && d < 0.2 ? "POOR_DISCRIMINATION" : null;
    return {
      questionId: id,
      answered: attempts.filter((a) => a.perQuestion[id]).length,
      difficulty: p === null ? null : r2(p),
      discrimination: d,
      commonWrong: [...wrong].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([answer, count]) => ({ answer, count })),
      flag,
    };
  });
}

export const FLAG_LABELS = {
  TOO_EASY: "سهل جداً",
  TOO_HARD: "صعب جداً — راجعي صياغته أو أعيدي شرح المهارة",
  POOR_DISCRIMINATION: "تمييز ضعيف — لا يفرّق بين المتقنات وغيرهن",
} as const;
