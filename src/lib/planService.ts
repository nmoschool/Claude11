import { prisma } from "@/lib/prisma";
import { HttpError, type StaffContext } from "@/lib/guard";
import { coverage, isHolidayWeek, reschedule, type RescheduleResult } from "@/lib/schedule";

export async function loadTerm(ctx: StaffContext, termId: string) {
  const term = await prisma.term.findFirst({
    where: { id: termId, year: { schoolId: ctx.schoolId } },
    include: { weeks: { orderBy: { number: "asc" } }, holidays: { orderBy: { start: "asc" } } },
  });
  if (!term) throw new HttpError(404, "NOT_FOUND", "الفصل الدراسي غير موجود");
  return term;
}

export async function listTerms(schoolId: string) {
  return prisma.term.findMany({
    where: { year: { schoolId, current: true } },
    orderBy: { number: "asc" },
    select: { id: true, number: true, title: true, startDate: true, endDate: true },
  });
}

/** الفصل الدراسي الجاري حسب التاريخ، وإلا الأول */
export async function currentTermId(schoolId: string): Promise<string | null> {
  const terms = await listTerms(schoolId);
  const now = new Date();
  return (terms.find((t) => now >= t.startDate && now <= new Date(t.endDate.getTime() + 86_400_000)) ?? terms[0])?.id ?? null;
}

export async function getPlan(ctx: StaffContext, termId: string) {
  const term = await loadTerm(ctx, termId);
  const units = await prisma.unit.findMany({
    where: { termId },
    orderBy: { order: "asc" },
    include: {
      lessons: { orderBy: { order: "asc" }, include: { skills: { include: { skill: true } } } },
    },
  });
  const lessons = units.flatMap((u) => u.lessons);
  return {
    term: { id: term.id, title: term.title, number: term.number, startDate: term.startDate, endDate: term.endDate },
    weeks: term.weeks.map((w) => ({ ...w, holiday: isHolidayWeek(w, term.holidays) })),
    holidays: term.holidays,
    units: units.map((u) => ({
      id: u.id,
      order: u.order,
      title: u.title,
      lessons: u.lessons.map((l) => ({
        id: l.id,
        unitId: u.id,
        order: l.order,
        title: l.title,
        kind: l.kind,
        periods: l.periods,
        objectives: l.objectives,
        status: l.status,
        weekId: l.weekId,
        skills: l.skills.map((s) => ({ code: s.skill.code, title: s.skill.title })),
      })),
    })),
    coverage: coverage(lessons, term.weeks, new Date()),
  };
}

export async function planReschedule(
  ctx: StaffContext,
  lessonId: string,
  toWeekId: string,
  shiftFollowing: boolean
): Promise<RescheduleResult & { termId: string }> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, unit: { term: { year: { schoolId: ctx.schoolId } } } },
    include: { unit: true },
  });
  if (!lesson) throw new HttpError(404, "NOT_FOUND", "الدرس غير موجود");
  const term = await loadTerm(ctx, lesson.unit.termId);
  const all = await prisma.lesson.findMany({ where: { unit: { termId: term.id } }, include: { unit: true } });
  try {
    const r = reschedule({
      lessonId,
      toWeekId,
      shiftFollowing,
      lessons: all.map((l) => ({ id: l.id, weekId: l.weekId, order: l.order, unitOrder: l.unit.order })),
      weeks: term.weeks,
      holidays: term.holidays,
    });
    return { ...r, termId: term.id };
  } catch (e) {
    throw new HttpError(400, "INVALID_SCHEDULE", (e as Error).message);
  }
}
