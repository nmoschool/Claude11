import { prisma } from "@/lib/prisma";
import { HttpError, type StaffContext } from "@/lib/guard";
import { gradebook } from "@/lib/gradebookService";
import { attendanceStats, loadStudentInScope } from "@/lib/studentService";
import { SUPPORT_THRESHOLD } from "@/lib/gradeCalc";

export async function studentReport(ctx: StaffContext, studentId: string, termId: string) {
  const s = await loadStudentInScope(ctx, studentId);
  const g = await gradebook(ctx, s.classId, termId);
  const row = g.rows.find((r) => r.student.id === studentId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "الطالبة غير موجودة في سجل هذا الفصل");
  const term = await prisma.term.findUniqueOrThrow({ where: { id: termId } });
  const [attendance, behavior, notes] = await Promise.all([
    prisma.attendance.findMany({ where: { studentId, period: 0, date: { gte: term.startDate, lte: term.endDate } } }),
    prisma.behaviorRecord.findMany({ where: { studentId, date: { gte: term.startDate, lte: new Date(term.endDate.getTime() + 86_400_000) } } }),
    prisma.studentNote.findMany({
      where: { studentId, kind: { in: ["ACADEMIC", "REMEDIAL"] }, visibleToSupervisor: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);
  const rank = g.rows.filter((r) => r.result.total !== null).sort((a, b) => b.result.total! - a.result.total!).findIndex((r) => r.student.id === studentId);
  return {
    student: { id: s.id, fullName: s.fullName, avatar: s.avatar },
    class: g.class,
    term: g.term,
    scheme: g.scheme,
    lock: g.lock,
    result: row.result,
    items: g.items.map((it) => ({ ...it, cell: row.cells[it.id] ?? null, classMean: g.itemStats[it.id].mean })),
    componentClassMeans: Object.fromEntries(g.scheme.components.map((c) => [c.id, g.componentStats[c.id].mean])),
    classMean: g.totalStats.mean,
    skills: g.skills
      .map((sk) => ({ ...sk, value: row.skills[sk.id] ?? null, classMean: g.classSkills[sk.id]?.mean ?? null }))
      .filter((x) => x.value !== null),
    weakSkills: g.skills.filter((sk) => (row.skills[sk.id] ?? 100) < SUPPORT_THRESHOLD).map((sk) => sk.title),
    attendance: attendanceStats(attendance),
    behaviorPoints: behavior.reduce((sum, b) => sum + (b.positive ? b.points : -b.points), 0),
    notes: notes.map((n) => ({ kind: n.kind, body: n.body, createdAt: n.createdAt })),
    rank: rank >= 0 ? rank + 1 : null,
    classSize: g.rows.length,
  };
}

/** طالبات يحتجن دعماً: مجموع أقل من حد الدعم أو مهارة أقل منه */
export function supportList(g: Awaited<ReturnType<typeof gradebook>>) {
  return g.rows
    .map((r) => ({
      student: r.student,
      total: r.result.total,
      weak: g.skills.filter((s) => r.skills[s.id] !== undefined && r.skills[s.id] < SUPPORT_THRESHOLD).map((s) => ({ title: s.title, value: r.skills[s.id] })),
    }))
    .filter((x) => (x.total !== null && x.total < SUPPORT_THRESHOLD) || x.weak.length)
    .sort((a, b) => (a.total ?? 101) - (b.total ?? 101));
}
