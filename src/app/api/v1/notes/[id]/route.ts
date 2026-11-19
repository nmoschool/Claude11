import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";

/** تحذف كاتبة الملاحظة ملاحظتها فقط */
export const DELETE = withPermission<{ id: string }>(["behavior:write", "supervision:comment"], async (_req, ctx, { id }) => {
  const n = await prisma.studentNote.findFirst({ where: { id, student: { class: { schoolId: ctx.schoolId } } }, include: { student: true } });
  if (!n || !ctx.inScope(n.student.classId)) throw new HttpError(404, "NOT_FOUND", "الملاحظة غير موجودة");
  if (n.authorId !== ctx.id) throw new HttpError(403, "NOT_AUTHOR", "لا يمكن حذف ملاحظة كتبتها مستخدمة أخرى");
  await prisma.studentNote.delete({ where: { id } });
  await audit({ actorId: ctx.id, action: "NOTE_DELETED", entity: "Student", entityId: n.studentId, before: { kind: n.kind } });
  return { ok: true };
});
