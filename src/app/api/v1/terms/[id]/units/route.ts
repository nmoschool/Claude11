import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { loadTerm } from "@/lib/planService";
import { audit } from "@/lib/audit";

const Body = z.object({ title: z.string().trim().min(2).max(150) });

export const POST = withPermission<{ id: string }>("curriculum:write", async (req, ctx, { id }) => {
  const { title } = Body.parse(await req.json());
  await loadTerm(ctx, id);
  const max = await prisma.unit.aggregate({ where: { termId: id }, _max: { order: true } });
  const unit = await prisma.unit.create({ data: { termId: id, title, order: (max._max.order ?? 0) + 1 } });
  await audit({ actorId: ctx.id, action: "UNIT_CREATED", entity: "Unit", entityId: unit.id, after: { title } });
  return { id: unit.id };
});
