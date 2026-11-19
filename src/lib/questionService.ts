import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, type StaffContext } from "@/lib/guard";
import { QTYPES, validateQuestion, type QType } from "@/lib/questionTypes";

export const QuestionInput = z.object({
  type: z.enum(QTYPES as [QType, ...QType[]]),
  stem: z.string().trim().min(2).max(1000),
  payload: z.unknown(),
  answerKey: z.unknown(),
  points: z.number().min(0).max(50).default(1),
  difficulty: z.number().int().min(1).max(3).default(1),
  bloom: z.enum(["تذكر", "فهم", "تطبيق", "تحليل"]).nullable().optional(),
  skillCode: z.string().nullable().optional(),
  lessonId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "APPROVED"]).default("APPROVED"),
});
export type QuestionInputT = z.infer<typeof QuestionInput>;

export async function questionData(ctx: StaffContext, input: QuestionInputT) {
  let checked;
  try {
    checked = validateQuestion(input.type, input.stem, input.payload, input.answerKey);
  } catch (e) {
    if (e instanceof z.ZodError) throw new HttpError(400, "INVALID_QUESTION", e.issues.map((i) => i.message).join("؛ "));
    throw e;
  }
  const skill = input.skillCode ? await prisma.skill.findUnique({ where: { code: input.skillCode } }) : null;
  if (input.skillCode && !skill) throw new HttpError(400, "UNKNOWN_SKILL", "مهارة غير معروفة");
  if (input.lessonId) {
    const l = await prisma.lesson.findFirst({ where: { id: input.lessonId, unit: { term: { year: { schoolId: ctx.schoolId } } } } });
    if (!l) throw new HttpError(400, "INVALID_LESSON", "درس غير صالح");
  }
  if (input.parentId) {
    const p = await prisma.question.findFirst({ where: { id: input.parentId, schoolId: ctx.schoolId, type: "READING_PASSAGE" } });
    if (!p) throw new HttpError(400, "INVALID_PARENT", "النص القرائي غير موجود");
    if (input.type === "READING_PASSAGE") throw new HttpError(400, "INVALID_PARENT", "لا يتداخل نصان قرائيان");
  }
  return {
    type: input.type,
    stem: input.stem,
    payload: checked.payload,
    answerKey: checked.answerKey,
    points: input.type === "READING_PASSAGE" ? 0 : input.points,
    difficulty: input.difficulty,
    bloom: input.bloom ?? null,
    skillId: skill?.id ?? null,
    lessonId: input.lessonId ?? null,
    parentId: input.parentId ?? null,
    status: input.status,
  };
}

export async function loadQuestion(ctx: StaffContext, id: string) {
  const q = await prisma.question.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!q) throw new HttpError(404, "NOT_FOUND", "السؤال غير موجود");
  return q;
}

/** هل السؤال مستخدم في نموذج اختبار؟ (عندها يُؤرشف ولا يُحذف ولا يُغيَّر مفتاحه) */
export async function usageCount(id: string) {
  return prisma.assessmentVersion.count({ where: { questionIds: { has: id } } });
}
