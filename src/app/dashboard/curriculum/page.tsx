import { requireStaffPage } from "@/lib/guard";
import { currentTermId, getPlan, listTerms } from "@/lib/planService";
import { prisma } from "@/lib/prisma";
import CurriculumBoard from "@/components/CurriculumBoard";

export default async function CurriculumPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const ctx = await requireStaffPage("curriculum:read");
  const terms = await listTerms(ctx.schoolId);
  const { term } = await searchParams;
  const termId = (term && terms.some((t) => t.id === term) ? term : await currentTermId(ctx.schoolId)) ?? null;
  if (!termId) return <p className="text-gray-500">لا توجد فصول دراسية مُعرّفة للسنة الحالية.</p>;
  const [plan, skills] = await Promise.all([
    getPlan(ctx, termId),
    prisma.skill.findMany({ orderBy: [{ domain: "asc" }, { code: "asc" }], select: { code: true, title: true, domain: true } }),
  ]);
  return (
    <CurriculumBoard
      initial={JSON.parse(JSON.stringify(plan))}
      terms={terms.map((t) => ({ id: t.id, title: t.title }))}
      skills={skills}
      canEdit={ctx.can("curriculum:write")}
    />
  );
}
