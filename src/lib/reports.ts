export interface GradedSubmission {
  id: string;
  totalScore: number | null;
  maxScore: number | null;
  gradedAt: Date | null;
  student: { id: string; fullName: string };
  assignment: {
    class: { id: string; name: string };
    worksheet: { title: string };
  };
}

export function percentOf(sub: { totalScore: number | null; maxScore: number | null }) {
  if (sub.totalScore == null || !sub.maxScore) return null;
  return Math.round((sub.totalScore / sub.maxScore) * 1000) / 10;
}

export function computeHonorBoard(submissions: GradedSubmission[], limit = 9) {
  const byStudent = new Map<
    string,
    { studentId: string; fullName: string; className: string; percents: number[] }
  >();

  for (const sub of submissions) {
    const percent = percentOf(sub);
    if (percent == null) continue;
    const key = sub.student.id;
    if (!byStudent.has(key)) {
      byStudent.set(key, {
        studentId: key,
        fullName: sub.student.fullName,
        className: sub.assignment.class.name,
        percents: [],
      });
    }
    byStudent.get(key)!.percents.push(percent);
  }

  return Array.from(byStudent.values())
    .map((s) => ({
      studentId: s.studentId,
      fullName: s.fullName,
      className: s.className,
      avgPercent: Math.round((s.percents.reduce((a, b) => a + b, 0) / s.percents.length) * 10) / 10,
      count: s.percents.length,
    }))
    .sort((a, b) => b.avgPercent - a.avgPercent)
    .slice(0, limit);
}

export function computeClassAverages(submissions: GradedSubmission[]) {
  const byClass = new Map<string, { name: string; percents: number[] }>();

  for (const sub of submissions) {
    const percent = percentOf(sub);
    if (percent == null) continue;
    const key = sub.assignment.class.id;
    if (!byClass.has(key)) byClass.set(key, { name: sub.assignment.class.name, percents: [] });
    byClass.get(key)!.percents.push(percent);
  }

  return Array.from(byClass.values()).map((c) => ({
    name: c.name,
    average: Math.round((c.percents.reduce((a, b) => a + b, 0) / c.percents.length) * 10) / 10,
  }));
}
