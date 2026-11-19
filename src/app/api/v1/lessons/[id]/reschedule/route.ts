import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { planReschedule } from "@/lib/planService";

const Body = z.object({
  toWeekId: z.string(),
  shiftFollowing: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  markPostponed: z.boolean().default(false),
});

/** dryRun=true يعيد المعاينة (ما سيتحرك وما سيتجاوز نهاية الفصل) دون حفظ */
export const POST = withPermission<{ id: string }>("curriculum:write", async (req, ctx, { id }) => {
  const body = Body.parse(await req.json());
  const r = await planReschedule(ctx, id, body.toWeekId, body.shiftFollowing);
  if (body.dryRun) return { ...r, applied: false };

  await prisma.$transaction([
    ...r.moves.map((m) => prisma.lesson.update({ where: { id: m.lessonId }, data: { weekId: m.toWeekId } })),
    ...(body.markPostponed ? [prisma.lesson.update({ where: { id }, data: { status: "POSTPONED" } })] : []),
  ]);
  await audit({
    actorId: ctx.id,
    action: "LESSON_RESCHEDULED",
    entity: "Lesson",
    entityId: id,
    after: { toWeekId: body.toWeekId, shiftFollowing: body.shiftFollowing, moved: r.moves.length, overflow: r.overflow },
  });
  return { ...r, applied: true };
});
