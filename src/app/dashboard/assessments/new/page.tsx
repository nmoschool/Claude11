import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/guard";
import { currentTermId, listTerms } from "@/lib/planService";
import AssessmentBuilder from "@/components/AssessmentBuilder";

export default async function NewAssessment() {
  const ctx = await requireStaffPage("assessments:write");
  const [terms, current, skills, units] = await Promise.all([
    listTerms(ctx.schoolId),
    currentTermId(ctx.schoolId),
    prisma.skill.findMany({ orderBy: [{ domain: "asc" }, { code: "asc" }], select: { code: true, title: true, domain: true } }),
    prisma.unit.findMany({
      where: { term: { year: { schoolId: ctx.schoolId, current: true } } },
      orderBy: [{ term: { number: "asc" } }, { order: "asc" }],
      include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true } } },
    }),
  ]);
  return (
    <AssessmentBuilder
      terms={terms.map((t) => ({ id: t.id, title: t.title }))}
      defaultTerm={current ?? terms[0]?.id ?? ""}
      skills={skills}
      units={units.map((u) => ({ id: u.id, termId: u.termId, title: u.title, lessons: u.lessons }))}
    />
  );
}
