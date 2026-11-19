import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { finalizeIfExpired, loadQuestions } from "@/lib/assessmentService";
import { gradeAttempt } from "@/lib/autoGrade";
import { analyzeItems } from "@/lib/itemAnalysis";
import { renderVersion } from "@/lib/renderVersion";

/** نتائج النشر: محاولات الطالبات + تحليل الأسئلة (السهولة، التمييز، الأخطاء الشائعة) */
export const GET = withPermission<{ id: string }>("assessments:read", async (_req, ctx, { id }) => {
  const pub = await prisma.assessmentPublication.findFirst({
    where: { id, assessment: { term: { year: { schoolId: ctx.schoolId } } } },
    include: { assessment: { include: { versions: { orderBy: { label: "asc" } } } } },
  });
  if (!pub || !ctx.inScope(pub.classId)) throw new HttpError(404, "NOT_FOUND", "النشر غير موجود");
  const open = await prisma.attempt.findMany({ where: { publicationId: id, submittedAt: null }, select: { id: true } });
  for (const a of open) await finalizeIfExpired(a.id);

  const [students, attempts] = await Promise.all([
    prisma.student.findMany({ where: { classId: pub.classId, archived: false }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, avatar: true } }),
    prisma.attempt.findMany({ where: { publicationId: id } }),
  ]);
  const allIds = Array.from(new Set(pub.assessment.versions.flatMap((v) => v.questionIds)));
  const byId = await loadQuestions(allIds);
  const graded = attempts.map((at) => {
    const v = pub.assessment.versions.find((x) => x.id === at.versionId)!;
    const qs = v.questionIds.map((q) => byId.get(q)!).filter(Boolean);
    const g = gradeAttempt(qs, (at.answers as Record<string, unknown>) ?? {}, (at.manualScores as Record<string, number>) ?? {});
    return { at, v, g };
  });
  const submitted = graded.filter((x) => x.at.submittedAt);
  const base = pub.assessment.versions[0];
  const items = analyzeItems(base.questionIds, submitted.map((x) => ({ total: x.g.auto, perQuestion: x.g.perQuestion })));
  const gradeItem = pub.gradeItemId ? await prisma.gradeItem.findUnique({ where: { id: pub.gradeItemId }, include: { entries: true } }) : null;

  return {
    publication: { id: pub.id, classId: pub.classId, mode: pub.mode, opensAt: pub.opensAt, closesAt: pub.closesAt, gradeItemId: pub.gradeItemId },
    assessment: { id: pub.assessment.id, title: pub.assessment.title, kind: pub.assessment.kind },
    questions: renderVersion(base.questionIds, base.shuffleSeed, byId, false),
    students: students.map((s) => {
      const x = graded.find((g) => g.at.studentId === s.id);
      const entry = gradeItem?.entries.find((e) => e.studentId === s.id);
      return {
        student: s,
        attemptId: x?.at.id ?? null,
        version: x?.v.label ?? null,
        status: !x ? "NOT_STARTED" : !x.at.submittedAt ? "IN_PROGRESS" : x.g.pendingManual ? "NEEDS_GRADING" : "GRADED",
        score: x ? x.g.auto : null,
        max: x ? x.g.max : null,
        pendingManual: x?.g.pendingManual ?? 0,
        submittedAt: x?.at.submittedAt ?? null,
        inGradebook: entry ? Number(entry.score) : null,
        // للتصحيح اليدوي: الأسئلة المفتوحة وإجابات الطالبة عنها
        open: x
          ? x.v.questionIds
              .filter((q) => byId.get(q)?.type === "OPEN")
              .map((q) => ({ questionId: q, stem: byId.get(q)!.stem, max: byId.get(q)!.points, answer: String(((x.at.answers as any) ?? {})[q] ?? ""), score: ((x.at.manualScores as any) ?? {})[q] ?? null }))
          : [],
      };
    }),
    items,
  };
});
