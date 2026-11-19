import { notFound } from "next/navigation";
import { requireStaffPage, HttpError } from "@/lib/guard";
import { studentReport } from "@/lib/reportService";
import { currentTermId } from "@/lib/planService";
import { classLabel } from "@/lib/classes";
import { audit } from "@/lib/audit";
import { formatHijri } from "@/lib/dates";
import { NOTE_KINDS } from "@/lib/behavior";
import ReportHeader from "@/components/ReportHeader";
import { PercentBars } from "@/components/charts";

export const metadata = { title: "بطاقة الطالبة" };

export default async function ReportCard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ term?: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("reports:read");
  const termId = (await searchParams).term ?? (await currentTermId(ctx.schoolId));
  if (!termId) notFound();
  let r;
  try {
    r = await studentReport(ctx, id, termId);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  await audit({ actorId: ctx.id, action: "REPORT_VIEWED", entity: "Student", entityId: id, after: { termId, kind: "report-card" } });
  const comps = r.scheme.components;

  return (
    <article className="text-sm">
      <title>{`بطاقة ${r.student.fullName} — ${r.term.title}`}</title>
      <ReportHeader schoolId={ctx.schoolId} title="بطاقة الأداء في مادة لغتي" subtitle={r.term.title} />

      <section className="mb-4 grid grid-cols-4 gap-2 rounded-lg bg-gray-50 p-3">
        <div className="col-span-2"><span className="text-gray-500">الطالبة: </span><b className="text-base">{r.student.fullName}</b></div>
        <div><span className="text-gray-500">الفصل: </span><b>{classLabel(r.class)}</b></div>
        <div><span className="text-gray-500">الحضور: </span><b>{r.attendance.rate === null ? "—" : `${r.attendance.rate}٪`}</b> <span className="text-xs text-gray-500">({r.attendance.ABSENT} غياب)</span></div>
      </section>

      <section className="mb-4 flex items-stretch gap-3">
        <div className="flex-1 rounded-lg border-2 border-brand-600 p-3 text-center">
          <div className="text-xs text-gray-500">المجموع</div>
          <div className="text-3xl font-black text-brand-700">{r.result.total ?? "—"}<span className="text-base text-gray-400"> / 100</span></div>
          <div className="text-lg font-black">{r.result.grade ?? "لم يكتمل الرصد"}</div>
        </div>
        <div className="flex-1 rounded-lg border p-3 text-center">
          <div className="text-xs text-gray-500">متوسط الفصل</div>
          <div className="text-2xl font-black">{r.classMean ?? "—"}</div>
          {r.rank && <div className="text-xs text-gray-500">الترتيب {r.rank} من {r.classSize}</div>}
        </div>
        <div className="flex-1 rounded-lg border p-3 text-center">
          <div className="text-xs text-gray-500">اكتمال الرصد</div>
          <div className="text-2xl font-black">{r.result.completeness}٪</div>
          <div className="text-xs text-gray-500">{r.lock ? `✅ معتمدة ${formatHijri(r.lock.lockedAt)}` : "غير معتمدة بعد"}</div>
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 font-black">الدرجات حسب مكوّنات التقييم</h2>
        <table className="table border">
          <thead><tr><th>المكوّن</th><th>الوزن</th><th>درجة الطالبة</th><th>النسبة</th><th>متوسط الفصل</th></tr></thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.id}>
                <td className="font-bold">{c.title}</td>
                <td>{c.weight}</td>
                <td>{r.result.components[c.id] ?? "—"}</td>
                <td>{r.result.componentPercent[c.id] != null ? `${r.result.componentPercent[c.id]}٪` : "—"}</td>
                <td className="text-gray-500">{r.componentClassMeans[c.id] != null ? `${r.componentClassMeans[c.id]}٪` : "—"}</td>
              </tr>
            ))}
            <tr className="bg-brand-50 font-black"><td>المجموع</td><td>100</td><td>{r.result.earned}</td><td>{r.result.total != null ? `${r.result.total}٪` : "—"}</td><td>{r.classMean != null ? `${r.classMean}٪` : "—"}</td></tr>
          </tbody>
        </table>
        {r.result.completeness < 100 && r.result.total !== null && (
          <p className="mt-1 text-[11px] text-gray-500">المجموع محسوب من المكوّنات المرصودة حتى الآن ({r.result.completeness}٪ من الأوزان).</p>
        )}
      </section>

      {r.skills.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 font-black">الإتقان في مهارات لغتي</h2>
          <PercentBars title="إتقان المهارات" data={r.skills.map((s) => ({ label: s.title, value: s.value, compare: s.classMean }))} />
          <table className="table mt-2 border text-xs">
            <thead><tr><th>المهارة</th><th>المجال</th><th>إتقان الطالبة</th><th>متوسط الفصل</th></tr></thead>
            <tbody>{r.skills.map((s) => <tr key={s.id}><td>{s.title}</td><td className="text-gray-500">{s.domain}</td><td className="font-bold">{s.value}٪</td><td>{s.classMean ?? "—"}٪</td></tr>)}</tbody>
          </table>
        </section>
      )}

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <h2 className="mb-1 font-black">نقاط القوة</h2>
          <p>{r.skills.filter((s) => (s.value ?? 0) >= 80).map((s) => s.title).join("، ") || "—"}</p>
        </div>
        <div className={`rounded-lg border p-3 ${r.weakSkills.length ? "border-red-200 bg-red-50/40" : ""}`}>
          <h2 className="mb-1 font-black">مهارات تحتاج دعماً</h2>
          <p>{r.weakSkills.join("، ") || "لا توجد — أحسنتِ 🌟"}</p>
        </div>
      </section>

      {r.notes.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-1 font-black">ملاحظات المعلمة</h2>
          <ul className="list-disc space-y-1 pr-5">{r.notes.map((n, i) => <li key={i}><b>{NOTE_KINDS[n.kind as keyof typeof NOTE_KINDS]}:</b> {n.body}</li>)}</ul>
        </section>
      )}

      <section className="mb-4">
        <h2 className="font-black">تفاصيل التقييمات</h2>
        <table className="table mt-2 border text-xs">
          <thead><tr><th>التقييم</th><th>التاريخ</th><th>الدرجة</th><th>متوسط الفصل ٪</th></tr></thead>
          <tbody>
            {r.items.map((it) => (
              <tr key={it.id}>
                <td>{it.title}</td>
                <td className="text-gray-500">{formatHijri(it.date)}</td>
                <td className="font-bold">{!it.cell ? "—" : it.cell.status === "ABSENT" ? "غائبة" : it.cell.status === "EXCUSED" ? "بعذر" : `${it.cell.score ?? "—"} / ${it.maxScore}`}</td>
                <td>{it.classMean ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-8 grid grid-cols-3 gap-6 text-center text-xs">
        <div>معلمة المادة<div className="mt-8 border-t pt-1">التوقيع</div></div>
        <div>قائدة المدرسة<div className="mt-8 border-t pt-1">التوقيع</div></div>
        <div>ولي الأمر<div className="mt-8 border-t pt-1">التوقيع</div></div>
      </footer>
    </article>
  );
}
