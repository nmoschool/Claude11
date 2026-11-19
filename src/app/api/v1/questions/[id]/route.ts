import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { QuestionInput, questionData, loadQuestion, usageCount } from "@/lib/questionService";

export const PATCH = withPermission<{ id: string }>("assessments:write", async (req, ctx, { id }) => {
  const before = await loadQuestion(ctx, id);
  const raw = await req.json();
  const input = QuestionInput.parse({
    type: before.type,
    stem: before.stem,
    payload: before.payload,
    answerKey: before.answerKey,
    points: Number(before.points),
    difficulty: before.difficulty,
    status: before.status,
    parentId: before.parentId,
    lessonId: before.lessonId,
    ...raw,
  });
  // سؤال مستخدم في اختبار: لا يتغير نوعه أو مفتاحه أو درجته (حتى لا تتغير نتائج سابقة)
  const used = await usageCount(id);
  if (used && (input.type !== before.type || JSON.stringify(input.answerKey) !== JSON.stringify(before.answerKey) || input.points !== Number(before.points))) {
    throw new HttpError(409, "IN_USE", `السؤال مستخدم في ${used} نموذج؛ انسخيه بدلاً من تعديل مفتاحه أو درجته`);
  }
  const data = await questionData(ctx, input);
  await prisma.question.update({ where: { id }, data });
  await audit({ actorId: ctx.id, action: "QUESTION_UPDATED", entity: "Question", entityId: id, before: { stem: before.stem, answerKey: before.answerKey }, after: { stem: data.stem, answerKey: data.answerKey, status: data.status } });
  return { ok: true };
});

/** يُحذف إن لم يُستخدم، وإلا يُؤرشف (يختفي من البنك ويبقى في الاختبارات السابقة) */
export const DELETE = withPermission<{ id: string }>("assessments:write", async (_req, ctx, { id }) => {
  const q = await loadQuestion(ctx, id);
  const ids = [id, ...(await prisma.question.findMany({ where: { parentId: id }, select: { id: true } })).map((c) => c.id)];
  const used = (await Promise.all(ids.map(usageCount))).some(Boolean);
  if (used) await prisma.question.updateMany({ where: { id: { in: ids } }, data: { archived: true } });
  else await prisma.question.deleteMany({ where: { id: { in: ids } } });
  await audit({ actorId: ctx.id, action: used ? "QUESTION_ARCHIVED" : "QUESTION_DELETED", entity: "Question", entityId: id, before: { stem: q.stem } });
  return { archived: used };
});
