import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadAssessment, versionView, KIND_LABELS } from "@/lib/assessmentService";
import { classLabel } from "@/lib/classes";

export const GET = withPermission<{ id: string }>("assessments:read", async (_req, ctx, { id }) => {
  const a = await loadAssessment(ctx, id);
  const first = a.versions[0] ? await versionView(a.versions[0].id, false) : null;
  const classes = await prisma.schoolClass.findMany({ where: { id: { in: a.publications.map((p) => p.classId) } } });
  const counts = await prisma.attempt.groupBy({ by: ["publicationId"], where: { publicationId: { in: a.publications.map((p) => p.id) }, submittedAt: { not: null } }, _count: true });
  return {
    id: a.id,
    kind: a.kind,
    kindLabel: KIND_LABELS[a.kind],
    title: a.title,
    term: { id: a.term.id, title: a.term.title },
    durationMin: a.durationMin,
    instructions: a.instructions,
    total: first?.total ?? 0,
    versions: a.versions.map((v) => ({ id: v.id, label: v.label })),
    questions: first?.questions ?? [],
    publications: a.publications
      .filter((p) => ctx.inScope(p.classId))
      .map((p) => ({
        id: p.id,
        classId: p.classId,
        classLabel: classLabel(classes.find((c) => c.id === p.classId)!),
        mode: p.mode,
        opensAt: p.opensAt,
        closesAt: p.closesAt,
        gradeItemId: p.gradeItemId,
        submitted: counts.find((c) => c.publicationId === p.id)?._count ?? 0,
      })),
  };
});

export const DELETE = withPermission<{ id: string }>("assessments:write", async (_req, ctx, { id }) => {
  const a = await loadAssessment(ctx, id);
  const attempts = await prisma.attempt.count({ where: { version: { assessmentId: id } } });
  if (attempts) throw new HttpError(409, "HAS_ATTEMPTS", "للاختبار محاولات طالبات؛ لا يمكن حذفه");
  await prisma.assessment.delete({ where: { id } });
  await audit({ actorId: ctx.id, action: "ASSESSMENT_DELETED", entity: "Assessment", entityId: id, before: { title: a.title } });
  return { ok: true };
});
