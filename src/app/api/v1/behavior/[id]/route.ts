import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";

export const DELETE = withPermission<{ id: string }>("behavior:write", async (_req, ctx, { id }) => {
  const b = await prisma.behaviorRecord.findFirst({ where: { id, student: { class: { schoolId: ctx.schoolId } } }, include: { student: true } });
  if (!b || !ctx.inScope(b.student.classId)) throw new HttpError(404, "NOT_FOUND", "السجل غير موجود");
  await prisma.behaviorRecord.delete({ where: { id } });
  await audit({ actorId: ctx.id, action: "BEHAVIOR_DELETED", entity: "Student", entityId: b.studentId, before: { category: b.category, positive: b.positive, date: b.date } });
  return { ok: true };
});
