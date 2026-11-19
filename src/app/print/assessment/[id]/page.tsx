import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, HttpError } from "@/lib/guard";
import { versionView, KIND_LABELS } from "@/lib/assessmentService";
import { audit } from "@/lib/audit";
import AssessmentSheet from "@/components/AssessmentSheet";

export const metadata = { title: "ورقة اختبار" };

/** /print/assessment/<versionId>?answers=1 */
export default async function PrintAssessment({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ answers?: string }> }) {
  const { id } = await params;
  const answers = (await searchParams).answers === "1";
  const ctx = await requireStaffPage("assessments:read");
  let v;
  try {
    v = await versionView(id, false);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  const a = await prisma.assessment.findFirst({ where: { id: v.version.assessmentId, term: { year: { schoolId: ctx.schoolId } } }, include: { _count: { select: { versions: true } } } });
  if (!a) notFound();
  const school = await prisma.school.findUniqueOrThrow({ where: { id: ctx.schoolId } });
  if (answers) await audit({ actorId: ctx.id, action: "ANSWER_KEY_VIEWED", entity: "Assessment", entityId: a.id, after: { version: v.version.label } });
  return (
    <>
      <title>{`${a.title} — ${answers ? "نموذج الإجابة" : "ورقة الطالبة"} (${v.version.label})`}</title>
      <AssessmentSheet
        title={a.title}
        kindLabel={KIND_LABELS[a.kind]}
        versionLabel={v.version.label}
        versionCount={a._count.versions}
        total={v.total}
        durationMin={a.durationMin}
        instructions={a.instructions}
        questions={v.questions}
        raw={v.byId}
        answers={answers}
        schoolName={school.name}
      />
    </>
  );
}
