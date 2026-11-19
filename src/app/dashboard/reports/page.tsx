import Link from "next/link";
import { requireStaffPage } from "@/lib/guard";
import { gradebook } from "@/lib/gradebookService";
import { supportList } from "@/lib/reportService";
import { pickClassTerm } from "@/lib/gradebookPage";
import ClassReportBody from "@/components/ClassReportBody";
import ReportFilters from "@/components/ReportFilters";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ class?: string; term?: string }> }) {
  const ctx = await requireStaffPage("reports:read");
  const pick = await pickClassTerm(ctx, await searchParams);
  if (!pick.classId || !pick.termId) return <p className="text-gray-500">لا توجد فصول مسندة إليك.</p>;
  const g = await gradebook(ctx, pick.classId, pick.termId);
  const canExport = ctx.can("reports:export", pick.classId) || ctx.can("grades:export", pick.classId);
  const q = `term=${pick.termId}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">التقارير</h1>
        <ReportFilters classes={pick.classes} terms={pick.terms} classId={pick.classId} termId={pick.termId} />
      </div>

      <div className="card flex flex-wrap gap-2 p-4">
        <Link className="btn-primary" href={`/print/class-report/${g.class.id}?${q}`}>📄 التقرير الجماعي (PDF)</Link>
        {ctx.can("grades:export", g.class.id) && <Link className="btn-secondary" href={`/print/gradebook/${g.class.id}?${q}`}>📋 كشف الدرجات (PDF)</Link>}
        {ctx.can("grades:export", g.class.id) && <a className="btn-secondary" href={`/api/v1/classes/${g.class.id}/gradebook/export?${q}&format=xlsx`}>Excel</a>}
        {ctx.can("grades:export", g.class.id) && <a className="btn-secondary" href={`/api/v1/classes/${g.class.id}/gradebook/export?${q}&format=csv`}>CSV</a>}
        {ctx.can("grades:export", g.class.id) && <a className="btn-secondary" href={`/api/v1/classes/${g.class.id}/gradebook/export?${q}&format=noor`}>ملف «نور»</a>}
        {!canExport && <span className="text-sm text-gray-500">التصدير غير متاح وفق صلاحياتك.</span>}
      </div>

      <div className="card p-5">
        <ClassReportBody g={g} support={supportList(g)} />
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-black">التقارير الفردية (بطاقات الأداء)</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {g.rows.map((r) => (
            <Link key={r.student.id} href={`/print/report-card/${r.student.id}?${q}`} className="flex items-center justify-between rounded-lg border p-3 hover:border-brand-300 hover:bg-brand-50">
              <span className="font-bold"><span className="ml-1">{r.student.avatar}</span>{r.student.fullName}</span>
              <span className="text-sm"><b>{r.result.total ?? "—"}</b> <span className="text-xs text-gray-500">{r.result.grade ?? ""}</span></span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
