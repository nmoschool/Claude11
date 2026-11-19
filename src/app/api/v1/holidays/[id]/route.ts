import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";

export const DELETE = withPermission<{ id: string }>("curriculum:write", async (_req, ctx, { id }) => {
  const h = await prisma.holiday.findFirst({ where: { id, term: { year: { schoolId: ctx.schoolId } } } });
  if (!h) throw new HttpError(404, "NOT_FOUND", "الإجازة غير موجودة");
  await prisma.holiday.delete({ where: { id } });
  await audit({ actorId: ctx.id, action: "HOLIDAY_DELETED", entity: "Holiday", entityId: id, before: { title: h.title } });
  return { ok: true };
});
