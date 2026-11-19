import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/guard";
import QuestionBank from "@/components/QuestionBank";

export default async function BankPage() {
  const ctx = await requireStaffPage("assessments:read");
  const [skills, lessons] = await Promise.all([
    prisma.skill.findMany({ orderBy: [{ domain: "asc" }, { code: "asc" }], select: { code: true, title: true, domain: true } }),
    prisma.lesson.findMany({
      where: { unit: { term: { year: { schoolId: ctx.schoolId, current: true } } } },
      orderBy: [{ unit: { term: { number: "asc" } } }, { unit: { order: "asc" } }, { order: "asc" }],
      select: { id: true, title: true, unit: { select: { title: true } } },
    }),
  ]);
  return <QuestionBank skills={skills} lessons={lessons.map((l) => ({ id: l.id, title: `${l.unit.title} — ${l.title}` }))} canEdit={ctx.can("assessments:write")} />;
}
