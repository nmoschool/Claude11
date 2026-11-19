import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { loadClassInScope } from "@/lib/calendarService";
import { buildIcs, type IcsEvent } from "@/lib/ical";
import { EVENT_TYPES } from "@/lib/curriculum";
import { classLabel } from "@/lib/classes";

/** تصدير تقويم الفصل (الأحداث + الإجازات) لاستيراده في تقويم الجوال/Outlook */
export const GET = withPermission<{ id: string }>("curriculum:read", async (_req, ctx, { id }) => {
  const cls = await loadClassInScope(ctx, id);
  const [events, holidays] = await Promise.all([
    prisma.calendarEvent.findMany({ where: { classId: id }, orderBy: { date: "asc" } }),
    prisma.holiday.findMany({ where: { term: { year: { schoolId: ctx.schoolId, current: true } } } }),
  ]);
  const items: IcsEvent[] = [
    ...events.map((e) => ({ uid: e.id, date: e.date, title: `${EVENT_TYPES[e.type].label}: ${e.title}`, description: e.note ?? undefined })),
    ...holidays.map((h) => ({ uid: h.id, date: h.start, endDate: h.end, title: `إجازة: ${h.title}` })),
  ];
  const name = `لغتي — ${classLabel(cls)}`;
  return new Response(buildIcs(name, items), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`تقويم-${classLabel(cls)}.ics`)}`,
    },
  });
});
