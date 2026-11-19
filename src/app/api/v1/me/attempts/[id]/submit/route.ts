import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/guard";
import { withStudent } from "@/lib/studentGuard";
import { audit } from "@/lib/audit";
import { scoreAndSync } from "@/lib/assessmentService";

export const POST = withStudent<{ id: string }>(async (_req, student, { id }) => {
  const at = await prisma.attempt.findFirst({ where: { id, studentId: student.id } });
  if (!at) throw new HttpError(404, "NOT_FOUND", "المحاولة غير موجودة");
  if (at.submittedAt) throw new HttpError(409, "SUBMITTED", "تم التسليم من قبل");
  await prisma.attempt.update({ where: { id }, data: { submittedAt: new Date() } });
  const r = await scoreAndSync(id, null);
  await audit({ actorId: student.id, actorType: "STUDENT", action: "ATTEMPT_SUBMITTED", entity: "Student", entityId: student.id, after: { attemptId: id, auto: r.auto, pending: r.pendingManual } });
  // تُعرض للطالبة درجتها الآلية فقط، دون كشف الإجابات الصحيحة (قد يحلّ غيرها لاحقاً)
  return { score: r.auto, max: r.max, pendingManual: r.pendingManual };
});
