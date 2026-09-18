import { QuestionDraft } from "@/types";

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export interface AutoGenerateOptions {
  operation: "add" | "sub" | "mixed";
  count: number;
  min: number;
  max: number;
}

/** توليد تلقائي لمسائل حسابية (جمع/طرح) ضمن مدى محدد - أساس مولد أوراق العمل */
export function generateArithmeticQuestions({
  operation,
  count,
  min,
  max,
}: AutoGenerateOptions): QuestionDraft[] {
  const questions: QuestionDraft[] = [];

  for (let i = 0; i < count; i++) {
    const op = operation === "mixed" ? (Math.random() > 0.5 ? "add" : "sub") : operation;

    let a = randInt(min, max);
    let b = randInt(min, max);
    let answer: number;
    let symbol: string;

    if (op === "add") {
      symbol = "+";
      answer = a + b;
    } else {
      // نضمن عدم وجود نواتج سالبة لملاءمة الصفين الأول والثاني
      if (a < b) [a, b] = [b, a];
      symbol = "−";
      answer = a - b;
    }

    questions.push({
      clientId: uid(),
      type: "FILL_BLANK",
      text: `${a} ${symbol} ${b} = ____`,
      correct: String(answer),
      points: 1,
      autoGrade: true,
    });
  }

  return questions;
}

export function emptyQuestion(type: QuestionDraft["type"] = "MULTIPLE_CHOICE"): QuestionDraft {
  return {
    clientId: uid(),
    type,
    text: "",
    options: type === "MULTIPLE_CHOICE" ? ["", "", ""] : undefined,
    correct: "",
    points: 1,
    autoGrade: type !== "WORD_PROBLEM",
  };
}
