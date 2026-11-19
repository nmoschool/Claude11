"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/apiClient";
import { FLAG_LABELS } from "@/lib/itemAnalysis";
import { formatHijri } from "@/lib/dates";

const STATUS: Record<string, { label: string; cls: string }> = {
  NOT_STARTED: { label: "لم تبدأ", cls: "bg-gray-100 text-gray-500" },
  IN_PROGRESS: { label: "تحل الآن", cls: "bg-sky-50 text-sky-700" },
  NEEDS_GRADING: { label: "بانتظار التصحيح", cls: "bg-amber-50 text-amber-800" },
  GRADED: { label: "مصحّحة", cls: "bg-mint-50 text-mint-700" },
};

export default function AssessmentResults({ publicationId, canGrade }: { publicationId: string; canGrade: boolean }) {
  const [d, setD] = useState<any>(null);
  const [grading, setGrading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => api(`/api/v1/publications/${publicationId}/results`).then(setD, (e) => setMsg({ ok: false, text: e.message })), [publicationId]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <p className="text-gray-400">{msg?.text ?? "جارٍ التحميل..."}</p>;

  const submitted = d.students.filter((s: any) => s.status === "GRADED" || s.status === "NEEDS_GRADING");
  const avg = submitted.length ? (submitted.reduce((x: number, s: any) => x + (s.score / s.max) * 100, 0) / submitted.length).toFixed(1) : "—";
  const qById = Object.fromEntries(d.questions.map((q: any) => [q.id, q]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm text-gray-400"><Link href={`/dashboard/assessments/${d.assessment.id}`} className="hover:text-gray-600">{d.assessment.title}</Link> ←</div>
          <h1 className="text-2xl font-black">النتائج وتحليل الأسئلة</h1>
          <p className="text-sm text-gray-500">{d.publication.mode === "ONLINE" ? "💻 إلكتروني" : "📄 ورقي"} · يغلق {d.publication.closesAt ? formatHijri(d.publication.closesAt) : "—"} · سلّمت {submitted.length} من {d.students.length} · المتوسط {avg}٪</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`/print/assessment-batch/${publicationId}`}>🖨️ أوراق بأسماء الطالبات</Link>
          {d.publication.gradeItemId && <Link className="btn-secondary" href={`/dashboard/gradebook?class=${d.publication.classId}`}>📊 سجل الدرجات</Link>}
        </div>
      </div>
      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</div>}

      <section className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>الطالبة</th><th>النموذج</th><th>الحالة</th><th>الدرجة</th><th>في السجل</th><th /></tr></thead>
          <tbody>
            {d.students.map((s: any) => (
              <Fragment key={s.student.id}>
                <tr>
                  <td className="font-bold"><span className="ml-1">{s.student.avatar}</span>{s.student.fullName}</td>
                  <td>{s.version ?? "—"}</td>
                  <td><span className={`badge ${STATUS[s.status].cls}`}>{STATUS[s.status].label}{s.pendingManual ? ` (${s.pendingManual})` : ""}</span></td>
                  <td className="font-black">{s.score !== null ? `${s.score} / ${s.max}` : "—"}</td>
                  <td>{s.inGradebook ?? "—"}</td>
                  <td>{canGrade && s.open.length > 0 && s.status !== "IN_PROGRESS" && s.status !== "NOT_STARTED" && <button className="text-sm text-brand-700 underline" onClick={() => setGrading(grading === s.attemptId ? null : s.attemptId)}>✍️ تصحيح يدوي</button>}</td>
                </tr>
                {grading !== null && grading === s.attemptId && (
                  <tr><td colSpan={6}>
                    <ManualGrade attemptId={s.attemptId} open={s.open} onDone={(t: string) => { setGrading(null); setMsg({ ok: true, text: t }); load(); }} onError={(t: string) => setMsg({ ok: false, text: t })} />
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-black">تحليل الأسئلة</h2>
        <p className="text-xs text-gray-500">معامل السهولة: نسبة الإجابة الصحيحة (أعلى = أسهل). معامل التمييز: الفرق بين أعلى 27٪ وأدنى 27٪ من الطالبات (0.3 فأكثر = جيد). يُحسب من المحاولات المسلّمة، ولا تظهر الملاحظات قبل 5 محاولات.</p>
        <table className="table">
          <thead><tr><th>#</th><th>السؤال</th><th>السهولة</th><th>التمييز</th><th>أكثر الإجابات الخاطئة</th><th>ملاحظة</th></tr></thead>
          <tbody>
            {d.items.filter((it: any) => qById[it.questionId]?.number).map((it: any) => {
              const q = qById[it.questionId];
              return (
                <tr key={it.questionId}>
                  <td>{q.number}</td>
                  <td className="max-w-xs text-sm">{q.stem}</td>
                  <td>{it.difficulty !== null ? <Bar v={it.difficulty} /> : "—"}</td>
                  <td className={it.discrimination !== null && it.discrimination < 0.2 ? "font-bold text-red-600" : ""}>{it.discrimination ?? "—"}</td>
                  <td className="text-xs">{it.commonWrong.map((w: any) => `«${w.answer}» (${w.count})`).join("، ") || "—"}</td>
                  <td className="text-xs text-amber-700">{it.flag ? FLAG_LABELS[it.flag as keyof typeof FLAG_LABELS] : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Bar({ v }: { v: number }) {
  return (
    <div className="flex items-center gap-2" title={`${Math.round(v * 100)}٪ أجبن إجابة صحيحة`}>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${v * 100}%` }} /></div>
      <span className="text-xs font-bold">{Math.round(v * 100)}٪</span>
    </div>
  );
}

function ManualGrade({ attemptId, open, onDone, onError }: { attemptId: string; open: any[]; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries(open.filter((o) => o.score !== null).map((o) => [o.questionId, o.score])));
  async function save() {
    try {
      const r = await api(`/api/v1/attempts/${attemptId}/manual`, "PUT", { scores });
      onDone(r.pendingManual ? "حُفظ — بقيت أسئلة بلا تصحيح" : r.synced ? `اكتمل التصحيح: ${r.final} / ${r.max} ونُقلت للسجل` : `اكتمل التصحيح: ${r.final} / ${r.max} (السجل معتمد — أدخليها يدوياً بسبب)`);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <div className="space-y-3 rounded-lg bg-amber-50/50 p-3">
      {open.map((o) => (
        <div key={o.questionId} className="space-y-1">
          <div className="text-sm font-bold">{o.stem}</div>
          <p className="whitespace-pre-wrap rounded bg-white p-2 text-sm">{o.answer || <span className="text-gray-400">(لم تُجب)</span>}</p>
          <label className="flex items-center gap-2 text-sm">الدرجة:
            <input className="input w-20 text-center" type="number" min={0} max={o.max} step={0.5} value={scores[o.questionId] ?? ""} onChange={(e) => setScores({ ...scores, [o.questionId]: Number(e.target.value) })} />
            / {o.max}
          </label>
        </div>
      ))}
      <button className="btn-primary" onClick={save} disabled={open.some((o) => scores[o.questionId] === undefined)}>حفظ التصحيح</button>
    </div>
  );
}
