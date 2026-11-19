import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadClassInScope } from "@/lib/calendarService";
import { EventFields } from "@/lib/eventSchema";
import { parseDay } from "@/lib/dates";

export const POST = withPermission<{ id: string }>("curriculum:write", async (req, ctx, { id }) => {
  await loadClassInScope(ctx, id);
  const body = EventFields.parse(await req.json());
  const e = await prisma.calendarEvent.create({
    data: { classId: id, type: body.type, title: body.title, date: parseDay(body.date), note: body.note ?? null, lessonId: body.lessonId ?? null, createdBy: ctx.id },
  });
  await audit({ actorId: ctx.id, action: "EVENT_CREATED", entity: "SchoolClass", entityId: id, after: { eventId: e.id, ...body } });
  return { id: e.id };
});
