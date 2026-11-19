import { prisma } from "@/lib/prisma";
import type { StaffContext } from "@/lib/guard";
import { listClasses } from "@/lib/classes";
import { currentTermId, listTerms } from "@/lib/planService";

/** يحدد الفصل والفصل الدراسي المختارين (من الرابط أو الافتراضي) */
export async function pickClassTerm(ctx: StaffContext, sp: { class?: string; term?: string }) {
  const [classes, terms] = await Promise.all([listClasses(ctx), listTerms(ctx.schoolId)]);
  const classId = classes.find((c) => c.id === sp.class)?.id ?? classes[0]?.id ?? null;
  const termId = terms.find((t) => t.id === sp.term)?.id ?? (await currentTermId(ctx.schoolId));
  const skills = await prisma.skill.findMany({ orderBy: [{ domain: "asc" }, { code: "asc" }], select: { id: true, code: true, title: true, domain: true } });
  return {
    classes: classes.map((c) => ({ id: c.id, label: c.label })),
    terms: terms.map((t) => ({ id: t.id, title: t.title })),
    classId,
    termId,
    skills,
  };
}
