import type { Gradebook } from "@/lib/gradebookService";
import type { supportList } from "@/lib/reportService";
import { DistributionBars, PercentBars, SkillHeatmap } from "@/components/charts";

/** جسم التقرير الجماعي — يُستخدم في صفحة التقارير وفي قالب الطباعة */
export default function ClassReportBody({ g, support }: { g: Gradebook; support: ReturnType<typeof supportList> }) {
  const t = g.totalStats;
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="متوسط الفصل" value={t.mean ?? "—"} />
        <Kpi label="الوسيط" value={t.median ?? "—"} />
        <Kpi label="الانحراف المعياري" value={t.sd ?? "—"} />
        <Kpi label="نسبة الإتقان" value={t.mastery != null ? `${t.mastery}٪` : "—"} />
        <Kpi label="تحتاج دعماً" value={t.needSupport != null ? `${t.needSupport}٪` : "—"} warn={(t.needSupport ?? 0) > 20} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <h2 className="mb-2 font-black">توزيع التقديرات</h2>
          <DistributionBars title="توزيع التقديرات" data={g.gradeDistribution} />
          <table className="table mt-2 text-xs"><tbody>{g.gradeDistribution.map((d) => <tr key={d.label}><td>{d.label} (≥{d.min})</td><td className="font-bold">{d.count}</td></tr>)}</tbody></table>
        </div>
        <div className="rounded-lg border p-3">
          <h2 className="mb-2 font-black">متوسط الفصل في كل مكوّن</h2>
          <PercentBars title="متوسطات المكوّنات" data={g.scheme.components.map((c) => ({ label: c.title, value: g.componentStats[c.id].mean }))} />
          <table className="table mt-2 text-xs">
            <thead><tr><th>المكوّن</th><th>المتوسط</th><th>الأدنى</th><th>الأعلى</th></tr></thead>
            <tbody>{g.scheme.components.map((c) => { const s = g.componentStats[c.id]; return <tr key={c.id}><td>{c.title}</td><td className="font-bold">{s.mean ?? "—"}</td><td>{s.min ?? "—"}</td><td>{s.max ?? "—"}</td></tr>; })}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border p-3">
        <h2 className="mb-2 font-black">خريطة إتقان المهارات</h2>
        <SkillHeatmap
          students={g.rows.map((r) => r.student)}
          skills={g.skills}
          values={Object.fromEntries(g.rows.map((r) => [r.student.id, r.skills]))}
        />
        {g.skills.length > 0 && (
          <table className="table mt-3 text-xs">
            <thead><tr><th>المهارة</th><th>متوسط الفصل</th><th>نسبة الإتقان</th><th>تحتاج دعماً</th></tr></thead>
            <tbody>{g.skills.map((s) => { const st = g.classSkills[s.id]; return <tr key={s.id}><td>{s.title}</td><td className="font-bold">{st.mean}٪</td><td>{st.mastery}٪</td><td>{st.needSupport}٪</td></tr>; })}</tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border p-3">
        <h2 className="mb-2 font-black">الدعم العلاجي ({support.length})</h2>
        {support.length ? (
          <table className="table text-xs">
            <thead><tr><th>الطالبة</th><th>المجموع</th><th>المهارات تحت حد الدعم</th><th>المقترح</th></tr></thead>
            <tbody>
              {support.map((s) => (
                <tr key={s.student.id}>
                  <td className="font-bold">{s.student.fullName}</td>
                  <td>{s.total ?? "—"}</td>
                  <td>{s.weak.map((w) => `${w.title} (${w.value}٪)`).join("، ") || "—"}</td>
                  <td className="text-gray-600">{s.weak.length ? `أوراق علاجية وألعاب في: ${s.weak.slice(0, 2).map((w) => w.title).join(" و")}` : "متابعة فردية وتواصل مع ولي الأمر"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-gray-500">لا توجد طالبات تحت حد الدعم 🌟</p>}
      </section>
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-center ${warn ? "bg-red-50" : "bg-gray-50"}`}>
      <div className={`text-xl font-black ${warn ? "text-red-600" : ""}`}>{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}
