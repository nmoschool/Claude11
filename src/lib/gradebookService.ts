import { prisma } from "@/lib/prisma";
import { HttpError, type StaffContext } from "@/lib/guard";
import { loadTerm } from "@/lib/planService";
import { loadClassInScope } from "@/lib/calendarService";
import {
  DEFAULT_SCALE,
  itemPercent,
  skillMastery,
  stats,
  studentResult,
  type CalcEntry,
  type ScaleBand,
} from "@/lib/gradeCalc";

export const DEFAULT_COMPONENTS = [
  { kind: "PARTICIPATION", title: "المشاركة والتفاعل الصفي", weight: 10 },
  { kind: "HOMEWORK", title: "الواجبات", weight: 10 },
  { kind: "PERFORMANCE", title: "المهام الأدائية", weight: 20 },
  { kind: "QUIZ", title: "الاختبارات القصيرة", weight: 20 },
  { kind: "MIDTERM", title: "الاختبار الفتري", weight: 10 },
  { kind: "FINAL", title: "الاختبار النهائي", weight: 30 },
] as const;

export const COMPONENT_KIND_LABELS: Record<string, string> = {
  PARTICIPATION: "مشاركة",
  HOMEWORK: "واجبات",
  PERFORMANCE: "مهام أدائية",
  QUIZ: "اختبارات قصيرة",
  MIDTERM: "فتري",
  FINAL: "نهائي",
  CUSTOM: "مخصص",
};

/** مخطط التقييم للفصل الدراسي — يُنشأ بالأوزان الافتراضية عند أول استخدام */
export async function ensureScheme(termId: string) {
  const existing = await prisma.assessmentScheme.findFirst({
    where: { termId },
    include: { components: { orderBy: { order: "asc" } } },
  });
  if (existing) return existing;
  return prisma.assessmentScheme.create({
    data: {
      termId,
      gradeScale: DEFAULT_SCALE as unknown as object,
      components: { create: DEFAULT_COMPONENTS.map((c, i) => ({ ...c, order: i + 1 })) },
    },
    include: { components: { orderBy: { order: "asc" } } },
  });
}

export async function schemeView(termId: string) {
  const s = await ensureScheme(termId);
  const locks = await prisma.gradeLock.count({ where: { termId } });
  return {
    id: s.id,
    absentAsZero: s.absentAsZero,
    gradeScale: s.gradeScale as unknown as ScaleBand[],
    components: s.components.map((c) => ({ id: c.id, kind: c.kind, title: c.title, order: c.order, weight: Number(c.weight) })),
    /** بعد اعتماد أي فصل تُجمَّد الأوزان حتى لا تتغير درجات معتمدة بأثر رجعي */
    weightsFrozen: locks > 0,
  };
}

export async function getLock(classId: string, termId: string) {
  return prisma.gradeLock.findUnique({ where: { classId_termId: { classId, termId } } });
}

export async function gradebook(ctx: StaffContext, classId: string, termId: string) {
  const cls = await loadClassInScope(ctx, classId);
  const term = await loadTerm(ctx, termId);
  const scheme = await schemeView(termId);
  const [items, students, lock, skills] = await Promise.all([
    prisma.gradeItem.findMany({ where: { classId, termId }, orderBy: [{ date: "asc" }, { title: "asc" }] }),
    prisma.student.findMany({
      where: { classId, archived: false },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, avatar: true, nationalIdLast4: true },
    }),
    getLock(classId, termId),
    prisma.skill.findMany({ select: { id: true, code: true, title: true, domain: true } }),
  ]);
  const entries = await prisma.gradeEntry.findMany({ where: { itemId: { in: items.map((i) => i.id) } } });

  const compOrder = new Map(scheme.components.map((c) => [c.id, c.order]));
  items.sort((a, b) => (compOrder.get(a.componentId) ?? 0) - (compOrder.get(b.componentId) ?? 0) || a.date.getTime() - b.date.getTime());

  const calcItems = items.map((i) => ({ id: i.id, componentId: i.componentId, maxScore: Number(i.maxScore), skillIds: i.skillIds }));
  const byStudent = new Map<string, CalcEntry[]>();
  for (const e of entries) {
    const arr = byStudent.get(e.studentId) ?? [];
    arr.push({ itemId: e.itemId, score: e.score === null ? null : Number(e.score), status: e.status });
    byStudent.set(e.studentId, arr);
  }

  const rows = students.map((s) => {
    const es = byStudent.get(s.id) ?? [];
    return {
      student: s,
      cells: Object.fromEntries(es.map((e) => [e.itemId, { score: e.score, status: e.status }])),
      result: studentResult(scheme.components, calcItems, es, { scale: scheme.gradeScale, absentAsZero: scheme.absentAsZero }),
      skills: skillMastery(calcItems, es, scheme.absentAsZero),
    };
  });

  const itemStats = Object.fromEntries(
    calcItems.map((it) => [
      it.id,
      stats(rows.map((r) => itemPercent((byStudent.get(r.student.id) ?? []).find((e) => e.itemId === it.id), it.maxScore, scheme.absentAsZero))),
    ])
  );
  const componentStats = Object.fromEntries(scheme.components.map((c) => [c.id, stats(rows.map((r) => r.result.componentPercent[c.id]))]));
  const totalStats = stats(rows.map((r) => r.result.total));
  const gradeDistribution = scheme.gradeScale
    .slice()
    .sort((a, b) => b.min - a.min)
    .map((b) => ({ label: b.label, min: b.min, count: rows.filter((r) => r.result.grade === b.label).length }));

  const usedSkillIds = Array.from(new Set(items.flatMap((i) => i.skillIds)));
  const skillInfo = skills.filter((s) => usedSkillIds.includes(s.id));
  const classSkills = Object.fromEntries(skillInfo.map((s) => [s.id, stats(rows.map((r) => r.skills[s.id]))]));

  return {
    class: { id: cls.id, section: cls.section, grade: cls.grade },
    term: { id: term.id, title: term.title },
    scheme,
    lock: lock ? { lockedAt: lock.lockedAt, lockedBy: lock.lockedBy } : null,
    items: items.map((i) => ({
      id: i.id,
      componentId: i.componentId,
      title: i.title,
      maxScore: Number(i.maxScore),
      date: i.date,
      skillIds: i.skillIds,
    })),
    rows,
    itemStats,
    componentStats,
    totalStats,
    gradeDistribution,
    skills: skillInfo,
    classSkills,
  };
}

export type Gradebook = Awaited<ReturnType<typeof gradebook>>;

export async function loadItem(ctx: StaffContext, id: string) {
  const it = await prisma.gradeItem.findFirst({ where: { id, class: { schoolId: ctx.schoolId } }, include: { component: true } });
  if (!it || !ctx.inScope(it.classId)) throw new HttpError(404, "NOT_FOUND", "التقييم غير موجود");
  return it;
}
