import { prisma } from "@/lib/prisma";
import { HttpError, type StaffContext } from "@/lib/guard";
import { LESSON_KINDS } from "@/lib/curriculum";

export async function loadClassInScope(ctx: StaffContext, classId: string) {
  if (!ctx.inScope(classId)) throw new HttpError(403, "OUT_OF_SCOPE", "هذا الفصل خارج نطاق صلاحياتك");
  const cls = await prisma.schoolClass.findFirst({ where: { id: classId, schoolId: ctx.schoolId } });
  if (!cls) throw new HttpError(404, "NOT_FOUND", "الفصل غير موجود");
  return cls;
}

/** أحداث الفصل + دروس الخطة (حسب أسابيعها) + الإجازات في المدى المطلوب */
export async function classCalendar(ctx: StaffContext, classId: string, from: Date, to: Date) {
  await loadClassInScope(ctx, classId);
  const [events, weeks, holidays] = await Promise.all([
    prisma.calendarEvent.findMany({ where: { classId, date: { gte: from, lte: to } }, orderBy: { date: "asc" } }),
    prisma.week.findMany({
      where: { term: { year: { schoolId: ctx.schoolId } }, start: { lte: to }, end: { gte: from } },
      include: { lessons: { include: { unit: true }, orderBy: [{ unit: { order: "asc" } }, { order: "asc" }] } },
      orderBy: { start: "asc" },
    }),
    prisma.holiday.findMany({
      where: { term: { year: { schoolId: ctx.schoolId } }, start: { lte: to }, end: { gte: from } },
    }),
  ]);
  return {
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      date: e.date,
      note: e.note,
      lessonId: e.lessonId,
      rescheduledFrom: e.rescheduledFrom,
    })),
    weeks: weeks.map((w) => ({
      id: w.id,
      number: w.number,
      start: w.start,
      end: w.end,
      lessons: w.lessons.map((l) => ({ id: l.id, title: l.title, kind: LESSON_KINDS[l.kind], status: l.status, unit: l.unit.title })),
    })),
    holidays: holidays.map((h) => ({ id: h.id, title: h.title, start: h.start, end: h.end })),
  };
}
