"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { round2, validateWeights, type ScaleBand } from "@/lib/gradeCalc";

const KINDS: Record<string, string> = {
  PARTICIPATION: "مشاركة", HOMEWORK: "واجبات", PERFORMANCE: "مهام أدائية", QUIZ: "اختبارات قصيرة", MIDTERM: "فتري", FINAL: "نهائي", CUSTOM: "مخصص",
};
interface Comp { id?: string; kind: string; title: string; weight: number }
interface Scheme { components: Comp[]; gradeScale: ScaleBand[]; absentAsZero: boolean; weightsFrozen: boolean }

export default function SchemeEditor({ termId, termTitle, terms, initial, canEdit }: { termId: string; termTitle: string; terms: { id: string; title: string }[]; initial: Scheme; canEdit: boolean }) {
  const router = useRouter();
  const [comps, setComps] = useState<Comp[]>(initial.components);
  const [scale, setScale] = useState<ScaleBand[]>([...initial.gradeScale].sort((a, b) => b.min - a.min));
  const [absentAsZero, setAbsent] = useState(initial.absentAsZero);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ro = !canEdit || initial.weightsFrozen;
  const sum = round2(comps.reduce((s, c) => s + (Number(c.weight) || 0), 0));
  const err = validateWeights(comps.map((c) => Number(c.weight)));
  const set = (i: number, p: Partial<Comp>) => setComps(comps.map((c, j) => (j === i ? { ...c, ...p } : c)));

  async function save() {
    try {
      await api(`/api/v1/terms/${termId}/scheme`, "PUT", { components: comps.map((c) => ({ ...c, weight: Number(c.weight) })), gradeScale: scale.map((b) => ({ ...b, min: Number(b.min) })), absentAsZero });
      setMsg({ ok: true, text: "تم حفظ مخطط التقييم" });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black">أوزان التقييم وسلم التقديرات</h1>
          <p className="text-sm text-gray-500">{termTitle} · المخطط مشترك لكل فصول الصف الرابع في المدرسة. اضبطيه وفق لائحة تقويم الطالب المعتمدة.</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto" value={termId} onChange={(e) => router.push(`/dashboard/gradebook/settings?term=${e.target.value}`)} aria-label="الفصل الدراسي">{terms.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
          <Link className="btn-secondary" href={`/dashboard/gradebook?term=${termId}`}>← السجل</Link>
        </div>
      </div>
      {initial.weightsFrozen && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">🔒 الأوزان مجمّدة لأن درجات فصل واحد على الأقل معتمدة. فكّي الاعتماد أولاً لتعديلها.</div>}
      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</div>}

      <section className="card p-5">
        <h2 className="mb-3 font-black">مكوّنات التقييم</h2>
        <table className="table">
          <thead><tr><th>المكوّن</th><th>النوع</th><th className="w-28">الوزن</th><th /></tr></thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={c.id ?? `n${i}`}>
                <td><input className="input" disabled={ro} value={c.title} onChange={(e) => set(i, { title: e.target.value })} aria-label="اسم المكوّن" /></td>
                <td><select className="input" disabled={ro} value={c.kind} onChange={(e) => set(i, { kind: e.target.value })} aria-label="النوع">{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td><input className="input text-center" type="number" min={0.5} step={0.5} disabled={ro} value={c.weight} onChange={(e) => set(i, { weight: Number(e.target.value) })} aria-label="الوزن" /></td>
                <td>{!ro && comps.length > 1 && <button className="text-xs text-red-600" onClick={() => setComps(comps.filter((_, j) => j !== i))}>حذف</button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={2} className="font-black">المجموع</td><td className={`text-center text-lg font-black ${sum === 100 ? "text-mint-700" : "text-red-600"}`}>{sum}</td><td /></tr>
          </tfoot>
        </table>
        {!ro && <button className="btn-secondary mt-2" onClick={() => setComps([...comps, { kind: "CUSTOM", title: "مكوّن جديد", weight: 0 }])}>＋ مكوّن</button>}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-black">سلم التقديرات</h2>
        <div className="space-y-2">
          {scale.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-gray-500">من</span>
              <input className="input w-24 text-center" type="number" min={0} max={100} disabled={ro} value={b.min} onChange={(e) => setScale(scale.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)))} aria-label="الحد الأدنى" />
              <input className="input" disabled={ro} value={b.label} onChange={(e) => setScale(scale.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="التقدير" />
              {!ro && scale.length > 2 && <button className="text-xs text-red-600" onClick={() => setScale(scale.filter((_, j) => j !== i))}>حذف</button>}
            </div>
          ))}
        </div>
        {!ro && <button className="btn-secondary mt-2" onClick={() => setScale([...scale, { min: 0, label: "" }])}>＋ تقدير</button>}
      </section>

      <section className="card p-5">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" disabled={ro} checked={absentAsZero} onChange={(e) => setAbsent(e.target.checked)} />
          <span><b>الغياب بلا عذر يُحتسب صفراً</b><br /><span className="text-gray-500">إن أُلغي، يُعامل الغياب بلا عذر كتقييم غير مرصود (لا يدخل في الحساب). الغياب بعذر لا يُحتسب في الحالتين.</span></span>
        </label>
      </section>

      {!ro && <button className="btn-primary" disabled={!!err} onClick={save}>حفظ المخطط</button>}
    </div>
  );
}
