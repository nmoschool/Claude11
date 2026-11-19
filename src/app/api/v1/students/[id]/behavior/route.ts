import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadStudentInScope } from "@/lib/studentService";
import { parseDay, todayRiyadh } from "@/lib/dates";
import { BEHAVIOR_CATEGORIES } from "@/lib/behavior";


const Body = z.object({
  category: z.enum(BEHAVIOR_CATEGORIES as [string, ...string[]]),
  positive: z.boolean(),
  points: z.number().int().min(0).max(10).default(1),
  note: z.string().trim().max(300).nullable().optional(),
  date: z.string().optional(),
});

export const POST = withPermission<{ id: string }>("behavior:write", async (req, ctx, { id }) => {
  const s = await loadStudentInScope(ctx, id);
  const body = Body.parse(await req.json());
  const b = await prisma.behaviorRecord.create({
    data: { studentId: id, category: body.category, positive: body.positive, points: body.points, note: body.note ?? null, date: parseDay(body.date ?? todayRiyadh()), recordedBy: ctx.id },
  });
  await audit({ actorId: ctx.id, action: "BEHAVIOR_RECORDED", entity: "Student", entityId: s.id, after: { id: b.id, category: body.category, positive: body.positive } });
  return { id: b.id };
});
