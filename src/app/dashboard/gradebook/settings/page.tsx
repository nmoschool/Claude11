import { requireStaffPage } from "@/lib/guard";
import { currentTermId, listTerms, loadTerm } from "@/lib/planService";
import { schemeView } from "@/lib/gradebookService";
import SchemeEditor from "@/components/SchemeEditor";

export default async function SchemeSettings({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const ctx = await requireStaffPage("grades:read");
  const terms = await listTerms(ctx.schoolId);
  const sp = await searchParams;
  const termId = terms.find((t) => t.id === sp.term)?.id ?? (await currentTermId(ctx.schoolId));
  if (!termId) return <p>لا توجد فصول دراسية.</p>;
  const term = await loadTerm(ctx, termId);
  const scheme = await schemeView(termId);
  return <SchemeEditor termId={termId} termTitle={term.title} terms={terms.map((t) => ({ id: t.id, title: t.title }))} initial={scheme} canEdit={ctx.can("grades:write")} />;
}
