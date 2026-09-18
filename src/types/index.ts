export type QuestionType =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "WORD_PROBLEM";

export interface QuestionDraft {
  clientId: string;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  options?: string[]; // اختيار من متعدد
  correct: string; // الإجابة الصحيحة (نص/رقم) أو فهرس الخيار الصحيح كنص
  points: number;
  autoGrade: boolean;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "اختيار من متعدد",
  TRUE_FALSE: "صح / خطأ",
  FILL_BLANK: "أكمل الفراغ",
  WORD_PROBLEM: "مسألة حسابية (تصحيح يدوي)",
};
