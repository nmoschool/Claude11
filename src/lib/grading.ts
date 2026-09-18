import { QuestionType } from "@/types";

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * تصحيح تلقائي لأنواع الأسئلة القابلة للتصحيح الآلي (اختيار من متعدد، صح/خطأ، أكمل الفراغ).
 * أسئلة "المسألة الحسابية" (WORD_PROBLEM) تتطلب تصحيحاً يدوياً دائماً.
 */
export function autoGradeAnswer(
  type: QuestionType,
  correctJson: string,
  responseRaw: string | null | undefined
): boolean | null {
  if (type === "WORD_PROBLEM") return null;
  if (responseRaw == null || responseRaw === "") return false;

  const correct = JSON.parse(correctJson) as string;

  if (type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE") {
    return normalize(responseRaw) === normalize(correct);
  }

  if (type === "FILL_BLANK") {
    // مقارنة رقمية إن أمكن، وإلا نصية بعد التطبيع
    const numResponse = Number(responseRaw);
    const numCorrect = Number(correct);
    if (!Number.isNaN(numResponse) && !Number.isNaN(numCorrect)) {
      return numResponse === numCorrect;
    }
    return normalize(responseRaw) === normalize(correct);
  }

  return null;
}

export function computeGrade(scores: { points: number; earned: number }[]) {
  const max = scores.reduce((s, q) => s + q.points, 0);
  const total = scores.reduce((s, q) => s + q.earned, 0);
  const percent = max > 0 ? (total / max) * 100 : 0;
  return { total, max, percent: Math.round(percent * 10) / 10 };
}

export function letterGrade(percent: number): { label: string; color: string } {
  if (percent >= 90) return { label: "ممتاز", color: "text-brand-700 bg-brand-50" };
  if (percent >= 80) return { label: "جيد جداً", color: "text-blue-700 bg-blue-50" };
  if (percent >= 65) return { label: "جيد", color: "text-accent-700 bg-accent-50" };
  if (percent >= 50) return { label: "مقبول", color: "text-yellow-700 bg-yellow-50" };
  return { label: "يحتاج دعم", color: "text-red-700 bg-red-50" };
}
