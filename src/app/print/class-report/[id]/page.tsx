import { notFound } from "next/navigation";
import { requireStaffPage, HttpError } from "@/lib/guard";
import { gradebook } from "@/lib/gradebookService";
import { supportList } from "@/lib/reportService";
import { currentTermId } from "@/lib/planService";
import { classLabel } from "@/lib/classes";
import { audit } from "@/lib/audit";
import { MASTERY_THRESHOLD, SUPPORT_THRESHOLD } from "@/lib/gradeCalc";
import ReportHeader from "@/components/ReportHeader";
import ClassReportBody from "@/components/ClassReportBody";

export const metadata = { title: "تقرير الفصل" };

export default async function ClassReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ term?: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("reports:read");
  const termId = (await searchParams).term ?? (await currentTermId(ctx.schoolId));
  if (!termId) notFound();
  let g;
  try {
    g = await gradebook(ctx, id, termId);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  await audit({ actorId: ctx.id, action: "REPORT_VIEWED", entity: "SchoolClass", entityId: id, after: { termId, kind: "class-report" } });
  return (
    <article className="text-sm">
      <title>{`تقرير ${classLabel(g.class)} — ${g.term.title}`}</title>
      <ReportHeader schoolId={ctx.schoolId} title={`التقرير الجماعي لمادة لغتي — ${classLabel(g.class)}`} subtitle={g.term.title} />
      <ClassReportBody g={g} support={supportList(g)} />
      <p className="mt-4 text-[11px] text-gray-500">الإتقان ≥ {MASTERY_THRESHOLD}٪ · الدعم &lt; {SUPPORT_THRESHOLD}٪ · النسب محسوبة من الدرجات المرصودة حتى تاريخ الإصدار.</p>
    </article>
  );
}
