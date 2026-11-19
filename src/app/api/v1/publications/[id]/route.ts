import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";

/** إلغاء النشر (قبل أي محاولة) — يحذف عمود السجل المرتبط إن كان فارغاً */
export const DELETE = withPermission<{ id: string }>("assessments:publish", async (_req, ctx, { id }) => {
  const p = await prisma.assessmentPublication.findFirst({ where: { id, assessment: { term: { year: { schoolId: ctx.schoolId } } } }, include: { _count: { select: { attempts: true } } } });
  if (!p || !ctx.inScope(p.classId)) throw new HttpError(404, "NOT_FOUND", "النشر غير موجود");
  if (p._count.attempts) throw new HttpError(409, "HAS_ATTEMPTS", "بدأت طالبات الحل؛ أغلقي النشر بتعديل وقت الإغلاق بدلاً من حذفه");
  await prisma.assessmentPublication.delete({ where: { id } });
  if (p.gradeItemId) {
    const filled = await prisma.gradeEntry.count({ where: { itemId: p.gradeItemId } });
    if (!filled) await prisma.gradeItem.delete({ where: { id: p.gradeItemId } }).catch(() => {});
  }
  await audit({ actorId: ctx.id, action: "ASSESSMENT_UNPUBLISHED", entity: "SchoolClass", entityId: p.classId, before: { assessmentId: p.assessmentId } });
  return { ok: true };
});
