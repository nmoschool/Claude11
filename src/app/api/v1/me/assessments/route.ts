import { prisma } from "@/lib/prisma";
import { withStudent } from "@/lib/studentGuard";
import { KIND_LABELS } from "@/lib/assessmentService";

/** اختبارات فصل الطالبة المنشورة إلكترونياً وحالتها */
export const GET = withStudent(async (_req, student) => {
  const now = new Date();
  const pubs = await prisma.assessmentPublication.findMany({
    where: { classId: student.classId, mode: "ONLINE", opensAt: { lte: now } },
    include: { assessment: true, attempts: { where: { studentId: student.id } } },
    orderBy: { opensAt: "desc" },
  });
  return {
    assessments: pubs.map((p) => {
      const at = p.attempts[0];
      const closed = !!p.closesAt && p.closesAt < now;
      return {
        publicationId: p.id,
        title: p.assessment.title,
        kindLabel: KIND_LABELS[p.assessment.kind],
        durationMin: p.assessment.durationMin,
        closesAt: p.closesAt,
        status: at?.submittedAt ? "SUBMITTED" : closed ? "CLOSED" : at ? "IN_PROGRESS" : "OPEN",
        score: at?.finalScore != null ? Number(at.finalScore) : null,
      };
    }),
  };
});
