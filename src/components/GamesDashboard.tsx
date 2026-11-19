"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { formatHijri } from "@/lib/dates";

export default function GamesDashboard({ classId, classes, canManage, canIssue }: { classId: string; classes: { id: string; label: string }[]; canManage: boolean; canIssue: boolean }) {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cert, setCert] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => api(`/api/v1/classes/${classId}/games/analytics?days=${days}`).then(setD, (e) => setMsg({ ok: false, text: e.message })), [classId, days]);
  useEffect(() => { load(); }, [load]);

  async function settings(body: object, text: string) {
    try { await api(`/api/v1/classes/${classId}/games/settings`, "PATCH", body); setMsg({ ok: true, text }); load(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  if (!d) return <p className="text-gray-400">{msg?.text ?? "جارٍ التحميل..."}</p>;
  const t = d.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black">الألعاب التعليمية</h1>
        <div className="flex gap-2">
          <select className="input w-auto" value={classId} onChange={(e) => router.push(`/dashboard/games?class=${e.target.value}`)} aria-label="الفصل">{classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="المدة"><option value={7}>آخر 7 أيام</option><option value={30}>آخر 30 يوماً</option><option value={90}>آخر 90 يوماً</option></select>
        </div>
      </div>
      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</div>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="محاولات" value={t.attempts} />
        <Kpi label="الدقة" value={t.accuracy !== null ? `${t.accuracy}٪` : "—"} />
        <Kpi label="طالبات لعبن" value={`${t.players}/${d.students.length}`} />
        <Kpi label="دقائق التدريب" value={t.minutes} />
      </div>

      {d.notPlayedThisWeek.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">🕒 لم يلعبن هذا الأسبوع: {d.notPlayedThisWeek.join("، ")}</div>}

      <section className="card overflow-x-auto p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black">الألعاب</h2>
          {canManage && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={d.class.leaderboardVisible} onChange={(e) => settings({ leaderboardVisible: e.target.checked }, e.target.checked ? "لوحة الشرف ظاهرة للطالبات" : "أُخفيت لوحة الشرف")} />
              إظهار لوحة الشرف للطالبات
            </label>
          )}
        </div>
        <table className="table">
          <thead><tr><th>اللعبة</th><th>محاولات</th><th>لاعبات</th><th>الدقة</th><th>دقائق</th>{canManage && <th>مفعّلة</th>}</tr></thead>
          <tbody>
            {d.byGame.map((g: any) => (
              <tr key={g.code} className={g.enabled ? "" : "opacity-50"}>
                <td className="font-bold">{g.icon} {g.title}</td>
                <td>{g.attempts}</td><td>{g.players}</td>
                <td><Acc v={g.accuracy} /></td><td>{g.minutes}</td>
                {canManage && <td><input type="checkbox" aria-label={`تفعيل ${g.title}`} checked={g.enabled} onChange={(e) => settings({ disabledGames: e.target.checked ? d.class.disabledGames.filter((x: string) => x !== g.code) : [...d.class.disabledGames, g.code] }, e.target.checked ? `فُعّلت ${g.title}` : `عُطّلت ${g.title}`)} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-black">الدقة حسب المهارة (الأضعف أولاً)</h2>
          {d.bySkill.length ? (
            <table className="table"><tbody>{d.bySkill.map((s: any) => <tr key={s.code}><td>{s.title}</td><td className="w-40"><Acc v={s.accuracy} /></td><td className="text-xs text-gray-400">{s.attempts}</td></tr>)}</tbody></table>
          ) : <p className="text-sm text-gray-400">لا بيانات بعد.</p>}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-black">أصعب العناصر على الفصل</h2>
          {d.hardest.length ? (
            <table className="table"><thead><tr><th>العنصر</th><th>اللعبة</th><th>الدقة</th></tr></thead><tbody>{d.hardest.map((h: any, i: number) => <tr key={i}><td className="font-bold">{h.item}</td><td className="text-xs">{h.game}</td><td><Acc v={h.accuracy} /></td></tr>)}</tbody></table>
          ) : <p className="text-sm text-gray-400">يظهر العنصر بعد 3 محاولات على الأقل.</p>}
          <p className="mt-2 text-xs text-gray-500">اقتراح: أعيدي شرح العناصر الأقل دقة، أو أنشئي ورقة علاجية من بنك الأسئلة للمهارة نفسها.</p>
        </section>
      </div>

      <section className="card overflow-x-auto p-5">
        <h2 className="mb-3 font-black">الطالبات</h2>
        <table className="table">
          <thead><tr><th>الطالبة</th><th>النقاط</th><th>المستوى</th><th>الأوسمة</th><th>محاولات</th><th>الدقة</th><th>آخر لعب</th>{canIssue && <th />}</tr></thead>
          <tbody>
            {d.students.map((s: any) => (
              <tr key={s.id}>
                <td className="font-bold"><Link href={`/dashboard/students/${s.id}`} className="hover:text-brand-700"><span className="ml-1">{s.avatar}</span>{s.fullName}</Link></td>
                <td>{s.points}</td><td>{s.level}</td><td>{s.badges}</td><td>{s.attempts}</td>
                <td><Acc v={s.accuracy} /></td>
                <td className="text-xs text-gray-500">{s.lastPlayed ? formatHijri(s.lastPlayed) : "—"}</td>
                {canIssue && <td><button className="text-sm text-brand-700 underline" onClick={() => setCert({ id: s.id, name: s.fullName })}>📜 شهادة</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {cert && <IssueCertificate student={cert} onClose={() => setCert(null)} onDone={(t) => { setCert(null); setMsg({ ok: true, text: t }); }} onError={(t) => setMsg({ ok: false, text: t })} />}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="card p-4 text-center"><div className="text-2xl font-black">{value}</div><div className="text-xs text-gray-500">{label}</div></div>;
}

function Acc({ v }: { v: number | null }) {
  if (v === null) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex items-center gap-2" title={`${v}٪`}>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${v}%` }} /></div>
      <span className={`text-xs font-bold ${v < 60 ? "text-red-600" : ""}`}>{v}٪</span>
    </div>
  );
}

function IssueCertificate({ student, onClose, onDone, onError }: { student: { id: string; name: string }; onClose: () => void; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [f, setF] = useState({ title: "شهادة تفوق في مادة لغتي", reason: "" });
  const [issued, setIssued] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api(`/api/v1/students/${student.id}/certificates`, "POST", { title: f.title, reason: f.reason || undefined });
      setIssued(r.id);
    } catch (err) {
      onError((err as Error).message);
    }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card w-full max-w-md space-y-3 p-5" role="dialog" aria-label="إصدار شهادة">
        <h2 className="text-lg font-black">شهادة تقدير لـ {student.name}</h2>
        {issued ? (
          <>
            <p className="text-mint-700">✅ صدرت الشهادة وتظهر للطالبة في «شهاداتي».</p>
            <div className="flex gap-2">
              <Link className="btn-primary" href={`/print/certificate/${issued}`}>عرض / PDF</Link>
              <button type="button" className="btn-secondary" onClick={() => onDone("صدرت الشهادة")}>إغلاق</button>
            </div>
          </>
        ) : (
          <>
            <input className="input" required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="عنوان الشهادة" />
            <textarea className="input" placeholder="سبب التقدير (اختياري)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            <div className="flex gap-2"><button className="btn-primary">إصدار</button><button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button></div>
          </>
        )}
      </form>
    </div>
  );
}
