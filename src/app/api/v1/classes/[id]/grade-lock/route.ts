import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadClassInScope } from "@/lib/calendarService";
import { loadTerm } from "@/lib/planService";
import { getLock } from "@/lib/gradebookService";

const Body = z.object({ termId: z.string(), reason: z.string().trim().max(300).optional() });

/** اعتماد درجات الفصل (قفل) */
export const POST = withPermission<{ id: string }>("grades:lock", async (req, ctx, { id }) => {
  await loadClassInScope(ctx, id);
  const { termId } = Body.parse(await req.json());
  await loadTerm(ctx, termId);
  if (await getLock(id, termId)) throw new HttpError(409, "ALREADY_LOCKED", "الدرجات معتمدة مسبقاً");
  await prisma.gradeLock.create({ data: { classId: id, termId, lockedBy: ctx.id } });
  await audit({ actorId: ctx.id, action: "GRADES_LOCKED", entity: "SchoolClass", entityId: id, after: { termId } });
  return { ok: true };
});

/** فك الاعتماد — يتطلب سبباً */
export const DELETE = withPermission<{ id: string }>("grades:lock", async (req, ctx, { id }) => {
  await loadClassInScope(ctx, id);
  const { termId, reason } = Body.parse(await req.json());
  if (!reason || reason.length < 5) throw new HttpError(400, "REASON_REQUIRED", "اكتبي سبب فك الاعتماد");
  const lock = await getLock(id, termId);
  if (!lock) throw new HttpError(404, "NOT_LOCKED", "الدرجات غير معتمدة");
  await prisma.gradeLock.delete({ where: { classId_termId: { classId: id, termId } } });
  await audit({ actorId: ctx.id, action: "GRADES_UNLOCKED", entity: "SchoolClass", entityId: id, before: { termId, lockedAt: lock.lockedAt, lockedBy: lock.lockedBy }, reason });
  return { ok: true };
});
