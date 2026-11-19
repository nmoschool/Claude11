import { prisma } from "@/lib/prisma";
import { withPermission, HttpError, type StaffContext } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { EventFields } from "@/lib/eventSchema";
import { parseDay } from "@/lib/dates";

async function loadEvent(ctx: StaffContext, id: string) {
  const e = await prisma.calendarEvent.findFirst({ where: { id, class: { schoolId: ctx.schoolId } } });
  if (!e || !ctx.inScope(e.classId)) throw new HttpError(404, "NOT_FOUND", "الحدث غير موجود");
  return e;
}

/** تعديل/إعادة جدولة (السحب والإفلات يرسل date فقط) — يُحفظ التاريخ الأصلي في rescheduledFrom */
export const PATCH = withPermission<{ id: string }>("curriculum:write", async (req, ctx, { id }) => {
  const before = await loadEvent(ctx, id);
  const body = EventFields.partial().parse(await req.json());
  const date = body.date ? parseDay(body.date) : undefined;
  const moved = date && date.getTime() !== before.date.getTime();
  await prisma.calendarEvent.update({
    where: { id },
    data: {
      type: body.type,
      title: body.title,
      note: body.note,
      date,
      ...(moved && !before.rescheduledFrom ? { rescheduledFrom: before.date } : {}),
    },
  });
  await audit({
    actorId: ctx.id,
    action: moved ? "EVENT_RESCHEDULED" : "EVENT_UPDATED",
    entity: "SchoolClass",
    entityId: before.classId,
    before: { eventId: id, title: before.title, date: before.date },
    after: body,
  });
  return { ok: true };
});

export const DELETE = withPermission<{ id: string }>("curriculum:write", async (_req, ctx, { id }) => {
  const e = await loadEvent(ctx, id);
  await prisma.calendarEvent.delete({ where: { id } });
  await audit({ actorId: ctx.id, action: "EVENT_DELETED", entity: "SchoolClass", entityId: e.classId, before: { eventId: id, title: e.title, date: e.date } });
  return { ok: true };
});
