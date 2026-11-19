import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/guard";
import { loadQuestions, totalPoints, KIND_LABELS } from "@/lib/assessmentService";
import { renderVersion } from "@/lib/renderVersion";
import { versionForStudent } from "@/lib/generator";
import { classLabel } from "@/lib/classes";
import AssessmentSheet from "@/components/AssessmentSheet";

export const metadata = { title: "أوراق الفصل" };

/** دفعة طباعة: ورقة لكل طالبة باسمها ونموذجها (نفس توزيع الحل الإلكتروني) */
export default async function PrintBatch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("assessments:read");
  const pub = await prisma.assessmentPublication.findFirst({
    where: { id, assessment: { term: { year: { schoolId: ctx.schoolId } } } },
    include: { assessment: { include: { versions: { orderBy: { label: "asc" } } } } },
  });
  if (!pub || !ctx.inScope(pub.classId)) notFound();
  const [cls, students, school] = await Promise.all([
    prisma.schoolClass.findUniqueOrThrow({ where: { id: pub.classId } }),
    prisma.student.findMany({ where: { classId: pub.classId, archived: false }, orderBy: { fullName: "asc" } }),
    prisma.school.findUniqueOrThrow({ where: { id: ctx.schoolId } }),
  ]);
  const versions = pub.assessment.versions;
  const byId = await loadQuestions(Array.from(new Set(versions.flatMap((v) => v.questionIds))));
  const rendered = versions.map((v) => renderVersion(v.questionIds, v.shuffleSeed, byId, true));
  return (
    <>
      <title>{`${pub.assessment.title} — أوراق ${classLabel(cls)}`}</title>
      {students.map((s, i) => {
        const vi = versionForStudent(i, versions.length);
        return (
          <div key={s.id} style={{ breakAfter: "page" }}>
            <AssessmentSheet
              title={pub.assessment.title}
              kindLabel={KIND_LABELS[pub.assessment.kind]}
              versionLabel={versions[vi].label}
              versionCount={versions.length}
              total={totalPoints(versions[vi].questionIds, byId)}
              durationMin={pub.assessment.durationMin}
              instructions={pub.assessment.instructions}
              questions={rendered[vi]}
              raw={byId}
              answers={false}
              studentName={s.fullName}
              classLabel={classLabel(cls)}
              schoolName={school.name}
            />
          </div>
        );
      })}
    </>
  );
}
