import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError, type StaffContext } from "@/lib/guard";
import { audit } from "@/lib/audit";

async function loadUnit(ctx: StaffContext, id: string) {
  const u = await prisma.unit.findFirst({ where: { id, term: { year: { schoolId: ctx.schoolId } } }, include: { _count: { select: { lessons: true } } } });
  if (!u) throw new HttpError(404, "NOT_FOUND", "الوحدة غير موجودة");
  return u;
}

const Patch = z.object({ title: z.string().trim().min(2).max(150).optional(), order: z.number().int().min(1).optional() });

export const PATCH = withPermission<{ id: string }>("curriculum:write", async (req, ctx, { id }) => {
  const body = Patch.parse(await req.json());
  const before = await loadUnit(ctx, id);
  await prisma.unit.update({ where: { id }, data: body });
  await audit({ actorId: ctx.id, action: "UNIT_UPDATED", entity: "Unit", entityId: id, before: { title: before.title, order: before.order }, after: body });
  return { ok: true };
});

export const DELETE = withPermission<{ id: string }>("curriculum:write", async (_req, ctx, { id }) => {
  const u = await loadUnit(ctx, id);
  if (u._count.lessons > 0) throw new HttpError(409, "NOT_EMPTY", "احذفي دروس الوحدة أو انقليها أولاً");
  await prisma.unit.delete({ where: { id } });
  await audit({ actorId: ctx.id, action: "UNIT_DELETED", entity: "Unit", entityId: id, before: { title: u.title } });
  return { ok: true };
});
