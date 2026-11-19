"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/apiClient";
import { formatHijri, formatWeekday } from "@/lib/dates";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
interface Row { id: string; fullName: string; avatar: string; status: Status | null; note: string | null; streak: number }

const STATUS: Record<Status, { label: string; on: string }> = {
  PRESENT: { label: "حاضرة", on: "bg-mint-600 text-white" },
  LATE: { label: "متأخرة", on: "bg-amber-500 text-white" },
  ABSENT: { label: "غائبة", on: "bg-red-600 text-white" },
  EXCUSED: { label: "بعذر", on: "bg-sky-600 text-white" },
};

export default function AttendanceSheet({ classId, canEdit, today }: { classId: string; canEdit: boolean; today: string }) {
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [schoolDay, setSchoolDay] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api(`/api/v1/classes/${classId}/attendance?date=${date}`);
      setRows(r.students);
      setSchoolDay(r.schoolDay);
      setDirty(false);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }, [classId, date]);
  useEffect(() => { load(); }, [load]);

  const set = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  async function save() {
    const missing = rows.filter((r) => !r.status).length;
    if (missing && !confirm(`${missing} طالبة بلا حالة — ستُسجَّل «حاضرة». متابعة؟`)) return;
    setSaving(true);
    try {
      const r = await api(`/api/v1/classes/${classId}/attendance`, "PUT", {
        date,
        records: rows.map((r) => ({ studentId: r.id, status: r.status ?? "PRESENT", note: r.note || null })),
      });
      setMsg({ ok: true, text: `تم الحفظ: ${r.counts.PRESENT ?? 0} حاضرة، ${r.counts.ABSENT ?? 0} غائبة، ${r.counts.LATE ?? 0} متأخرة، ${r.counts.EXCUSED ?? 0} بعذر` });
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const alerts = rows.filter((r) => r.streak >= 3);
  const recorded = rows.filter((r) => r.status).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="label" htmlFor="att-date">التاريخ</label>
          <input id="att-date" type="date" className="input w-auto" max={today} value={date} onChange={(e) => { if (!dirty || confirm("توجد تغييرات غير محفوظة. تجاهلها؟")) setDate(e.target.value); }} />
          <p className="mt-1 text-sm text-gray-500">{formatWeekday(date)} {formatHijri(date)} · مُسجَّل {recorded}/{rows.length}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => { setRows((rs) => rs.map((r) => ({ ...r, status: r.status ?? "PRESENT" }))); setDirty(true); }}>الباقيات حاضرات</button>
            <button className="btn-primary" disabled={saving || !dirty} onClick={save}>{saving ? "..." : "حفظ الحضور"}</button>
          </div>
        )}
      </div>

      {!schoolDay && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">هذا اليوم عطلة نهاية أسبوع.</div>}
      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</div>}
      {alerts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          ⚠️ غياب متتالٍ (3 أيام فأكثر بدون عذر):{" "}
          {alerts.map((a, i) => <span key={a.id}>{i > 0 && "، "}<Link className="font-bold underline" href={`/dashboard/students/${a.id}`}>{a.fullName}</Link> ({a.streak} أيام)</span>)}
          {" "}— يُنصح بالتواصل مع ولي الأمر وتوثيق ذلك في ملاحظات الطالبة.
        </div>
      )}

      <div className="card divide-y">
        {rows.map((r, i) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="w-6 text-sm text-gray-400">{i + 1}</span>
            <Link href={`/dashboard/students/${r.id}`} className="min-w-[12rem] flex-1 font-bold hover:text-brand-700"><span className="ml-1">{r.avatar}</span>{r.fullName}</Link>
            <div className="flex gap-1" role="radiogroup" aria-label={`حالة ${r.fullName}`}>
              {(Object.keys(STATUS) as Status[]).map((s) => (
                <button key={s} role="radio" aria-checked={r.status === s} disabled={!canEdit}
                  onClick={() => set(r.id, { status: s })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${r.status === s ? STATUS[s].on : "bg-gray-100 text-gray-600 enabled:hover:bg-gray-200"}`}>
                  {STATUS[s].label}
                </button>
              ))}
            </div>
            {canEdit && (r.status === "ABSENT" || r.status === "EXCUSED" || r.status === "LATE") && (
              <input className="input w-48" placeholder="ملاحظة (السبب)" value={r.note ?? ""} onChange={(e) => set(r.id, { note: e.target.value })} />
            )}
            {!canEdit && r.note && <span className="text-xs text-gray-500">{r.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
