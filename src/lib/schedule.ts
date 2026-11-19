/**
 * منطق إعادة جدولة الدروس (نقي، بلا قاعدة بيانات) — docs القسم 3.3.
 * - أسبوع الإجازة = أسبوع تغطي الإجازات كل أيام دوامه (الأحد–الخميس) فيُتخطّى.
 * - «إزاحة التالي»: ينتقل الدرس وكل ما بعده بنفس عدد أسابيع الدراسة.
 * - ما يتجاوز آخر أسبوع دراسي يُوضع في الأخير ويُعاد في overflow للتنبيه.
 */

export interface WeekLite {
  id: string;
  number: number;
  start: Date;
  end: Date;
}
export interface HolidayLite {
  start: Date;
  end: Date;
}
export interface LessonLite {
  id: string;
  weekId: string | null;
  order: number;
  unitOrder: number;
}

const DAY = 86_400_000;

export function isHolidayWeek(week: WeekLite, holidays: HolidayLite[]): boolean {
  for (let t = week.start.getTime(); t <= week.end.getTime(); t += DAY) {
    const d = new Date(t);
    if (d.getUTCDay() > 4) continue; // الجمعة والسبت
    if (!holidays.some((h) => t >= h.start.getTime() && t <= h.end.getTime())) return false;
  }
  return true;
}

export function teachingWeeks(weeks: WeekLite[], holidays: HolidayLite[]): WeekLite[] {
  return [...weeks].sort((a, b) => a.number - b.number).filter((w) => !isHolidayWeek(w, holidays));
}

/** الترتيب الزمني للدروس: رقم الأسبوع ثم ترتيب الوحدة ثم ترتيب الدرس */
export function sequence(lessons: LessonLite[], weeks: WeekLite[]): LessonLite[] {
  const num = new Map(weeks.map((w) => [w.id, w.number]));
  return lessons
    .filter((l) => l.weekId && num.has(l.weekId))
    .sort(
      (a, b) =>
        num.get(a.weekId!)! - num.get(b.weekId!)! || a.unitOrder - b.unitOrder || a.order - b.order
    );
}

export interface RescheduleResult {
  moves: { lessonId: string; fromWeekId: string | null; toWeekId: string }[];
  overflow: string[];
}

export function reschedule(input: {
  lessonId: string;
  toWeekId: string;
  shiftFollowing: boolean;
  lessons: LessonLite[];
  weeks: WeekLite[];
  holidays: HolidayLite[];
}): RescheduleResult {
  const { lessonId, toWeekId, shiftFollowing, lessons, weeks, holidays } = input;
  const teach = teachingWeeks(weeks, holidays);
  const tIdx = new Map(teach.map((w, i) => [w.id, i]));
  const target = weeks.find((w) => w.id === toWeekId);
  if (!target) throw new Error("الأسبوع غير موجود");
  if (!tIdx.has(toWeekId)) throw new Error("لا يمكن الجدولة في أسبوع إجازة");

  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new Error("الدرس غير موجود");

  if (!shiftFollowing || !lesson.weekId) {
    return { moves: [{ lessonId, fromWeekId: lesson.weekId, toWeekId }], overflow: [] };
  }

  // موضع الدرس الحالي بين أسابيع الدراسة (إن كان في أسبوع إجازة نعامله كأقرب أسبوع دراسي قبله)
  const fromWeek = weeks.find((w) => w.id === lesson.weekId)!;
  let fromIdx = tIdx.get(fromWeek.id);
  if (fromIdx === undefined) {
    fromIdx = teach.filter((w) => w.number < fromWeek.number).length - 1;
  }
  const delta = tIdx.get(toWeekId)! - fromIdx;

  const seq = sequence(lessons, weeks);
  const startAt = seq.findIndex((l) => l.id === lessonId);
  const moves: RescheduleResult["moves"] = [];
  const overflow: string[] = [];
  const numById = new Map(weeks.map((w) => [w.id, w.number]));

  for (const l of seq.slice(startAt)) {
    let idx = tIdx.get(l.weekId!);
    if (idx === undefined) idx = teach.filter((w) => w.number < numById.get(l.weekId!)!).length - 1;
    let next = l.id === lessonId ? tIdx.get(toWeekId)! : idx + delta;
    if (next >= teach.length) {
      overflow.push(l.id);
      next = teach.length - 1;
    }
    if (next < 0) next = 0;
    if (teach[next].id !== l.weekId) moves.push({ lessonId: l.id, fromWeekId: l.weekId, toWeekId: teach[next].id });
  }
  return { moves, overflow };
}

/** التغطية: نسبة الدروس المنفّذة من المخطط حتى الأسبوع الحالي */
export function coverage(
  lessons: { weekId: string | null; status: string }[],
  weeks: WeekLite[],
  today: Date
) {
  const current = weeks.find((w) => today >= w.start && today.getTime() <= w.end.getTime() + 2 * DAY);
  const passed = new Set(
    weeks.filter((w) => w.end.getTime() < today.getTime() || w.id === current?.id).map((w) => w.id)
  );
  const due = lessons.filter((l) => l.weekId && passed.has(l.weekId));
  const done = due.filter((l) => l.status === "DONE").length;
  const doneTotal = lessons.filter((l) => l.status === "DONE").length;
  return {
    currentWeekNumber: current?.number ?? null,
    due: due.length,
    done,
    total: lessons.length,
    doneTotal,
    percent: due.length ? Math.round((done / due.length) * 100) : 100,
  };
}
