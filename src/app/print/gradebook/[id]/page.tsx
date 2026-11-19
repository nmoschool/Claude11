import { notFound } from "next/navigation";
import { requireStaffPage, HttpError } from "@/lib/guard";
import { gradebook } from "@/lib/gradebookService";
import { currentTermId } from "@/lib/planService";
import { classLabel } from "@/lib/classes";
import { audit } from "@/lib/audit";
import ReportHeader from "@/components/ReportHeader";

export const metadata = { title: "كشف الدرجات" };

export default async function GradeSheet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ term?: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("grades:export");
  const termId = (await searchParams).term ?? (await currentTermId(ctx.schoolId));
  if (!termId) notFound();
  let g;
  try {
    g = await gradebook(ctx, id, termId);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  await audit({ actorId: ctx.id, action: "REPORT_VIEWED", entity: "SchoolClass", entityId: id, after: { termId, kind: "grade-sheet" } });
  const comps = g.scheme.components;
  const cell = (c?: { score: number | null; status: string }) => (!c ? "" : c.status === "ABSENT" ? "غ" : c.status === "EXCUSED" ? "ع" : c.score ?? "");

  return (
    <article className="text-[10px]">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <title>{`كشف درجات ${classLabel(g.class)} — ${g.term.title}`}</title>
      <ReportHeader schoolId={ctx.schoolId} title={`كشف درجات لغتي — ${classLabel(g.class)}`} subtitle={`${g.term.title}${g.lock ? " · معتمد" : " · غير معتمد"}`} />
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1" rowSpan={2}>م</th>
            <th className="border p-1 text-right" rowSpan={2}>اسم الطالبة</th>
            {comps.map((c) => {
              const n = g.items.filter((i) => i.componentId === c.id).length;
              return <th key={c.id} className="border p-1" colSpan={n + 1}>{c.title} ({c.weight})</th>;
            })}
            <th className="border p-1" rowSpan={2}>المجموع</th>
            <th className="border p-1" rowSpan={2}>التقدير</th>
          </tr>
          <tr className="bg-gray-50">
            {comps.flatMap((c) => [
              ...g.items.filter((i) => i.componentId === c.id).map((i) => <th key={i.id} className="border p-0.5 font-normal">{i.title}<br />/{i.maxScore}</th>),
              <th key={c.id + "t"} className="border bg-brand-50 p-0.5">/{c.weight}</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r, idx) => (
            <tr key={r.student.id}>
              <td className="border p-1 text-center">{idx + 1}</td>
              <td className="whitespace-nowrap border p-1">{r.student.fullName}</td>
              {comps.flatMap((c) => [
                ...g.items.filter((i) => i.componentId === c.id).map((i) => <td key={i.id} className="border p-0.5 text-center">{cell(r.cells[i.id])}</td>),
                <td key={c.id + "t"} className="border bg-brand-50 p-0.5 text-center font-bold">{r.result.components[c.id] ?? ""}</td>,
              ])}
              <td className="border p-1 text-center font-black">{r.result.total ?? ""}</td>
              <td className="whitespace-nowrap border p-1 text-center">{r.result.grade ?? ""}</td>
            </tr>
          ))}
          <tr className="bg-gray-100 font-bold">
            <td className="border p-1" colSpan={2}>متوسط الفصل ٪</td>
            {comps.flatMap((c) => [
              ...g.items.filter((i) => i.componentId === c.id).map((i) => <td key={i.id} className="border p-0.5 text-center">{g.itemStats[i.id].mean ?? ""}</td>),
              <td key={c.id + "t"} className="border p-0.5 text-center">{g.componentStats[c.id].mean ?? ""}</td>,
            ])}
            <td className="border p-1 text-center">{g.totalStats.mean ?? ""}</td>
            <td className="border p-1" />
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-gray-500">غ = غائبة بلا عذر (تُحتسب صفراً{g.scheme.absentAsZero ? "" : " — معطّل"}) · ع = بعذر (لا تُحتسب)</p>
      <footer className="mt-6 grid grid-cols-2 gap-10 text-center">
        <div>معلمة المادة<div className="mt-6 border-t pt-1">الاسم والتوقيع</div></div>
        <div>قائدة المدرسة<div className="mt-6 border-t pt-1">الاسم والتوقيع</div></div>
      </footer>
    </article>
  );
}
