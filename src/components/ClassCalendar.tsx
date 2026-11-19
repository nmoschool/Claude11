"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/apiClient";
import { EVENT_TYPES, LESSON_STATUS, type EventTypeName } from "@/lib/curriculum";
import { dayKey, formatHijri, formatHijriShort } from "@/lib/dates";

interface Ev { id: string; type: EventTypeName; title: string; date: string; note: string | null; rescheduledFrom: string | null }
interface Wk { id: string; number: number; start: string; end: string; lessons: { id: string; title: string; kind: string; status: keyof typeof LESSON_STATUS; unit: string }[] }
interface Hol { id: string; title: string; start: string; end: string }
interface Data { events: Ev[]; weeks: Wk[]; holidays: Hol[] }

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

export default function ClassCalendar({ classId, label, canEdit, today }: { classId: string; label: string; canEdit: boolean; today: string }) {
  const [month, setMonth] = useState(() => { const t = new Date(today); return utc(t.getUTCFullYear(), t.getUTCMonth(), 1); });
  const [data, setData] = useState<Data>({ events: [], weeks: [], holidays: [] });
  const [adding, setAdding] = useState<string | null>(null);
  const [edit, setEdit] = useState<Ev | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // شبكة 6 أسابيع تبدأ من الأحد
  const days = useMemo(() => {
    const first = new Date(month);
    first.setUTCDate(1 - first.getUTCDay());
    return Array.from({ length: 42 }, (_, i) => utc(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate() + i));
  }, [month]);

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/v1/classes/${classId}/calendar?from=${dayKey(days[0])}&to=${dayKey(days[41])}`));
    } catch (e) {
      setFlash({ ok: false, text: (e as Error).message });
    }
  }, [classId, days]);
  useEffect(() => { load(); }, [load]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, Ev[]>();
    data.events.forEach((e) => m.set(dayKey(e.date), [...(m.get(dayKey(e.date)) ?? []), e]));
    return m;
  }, [data.events]);
  const holidayOf = (d: Date) => data.holidays.find((h) => d >= new Date(h.start) && d <= new Date(h.end));
  const weekOf = (d: Date) => data.weeks.find((w) => d >= new Date(w.start) && d.getTime() <= new Date(w.end).getTime() + 2 * 86400000);

  async function move(eventId: string, date: string) {
    try {
      await api(`/api/v1/events/${eventId}`, "PATCH", { date });
      setFlash({ ok: true, text: "تمت إعادة الجدولة" });
      load();
    } catch (e) {
      setFlash({ ok: false, text: (e as Error).message });
    }
  }

  const monthTitle = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const mid = utc(month.getUTCFullYear(), month.getUTCMonth(), 15);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-secondary" aria-label="الشهر السابق" onClick={() => setMonth(utc(month.getUTCFullYear(), month.getUTCMonth() - 1, 1))}>→</button>
          <div className="min-w-[12rem] text-center">
            <div className="text-lg font-black">{monthTitle}</div>
            <div className="text-xs text-gray-500">{new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { month: "long", year: "numeric", timeZone: "UTC" }).format(mid)}</div>
          </div>
          <button className="btn-secondary" aria-label="الشهر التالي" onClick={() => setMonth(utc(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))}>←</button>
          <button className="btn-secondary" onClick={() => { const t = new Date(today); setMonth(utc(t.getUTCFullYear(), t.getUTCMonth(), 1)); }}>اليوم</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(EVENT_TYPES).filter(([k]) => k !== "LESSON").map(([k, v]) => <span key={k} className={`badge ${v.color}`}>{v.label}</span>)}
          <a className="btn-secondary" href={`/api/v1/classes/${classId}/calendar.ics`}>📅 تصدير iCal</a>
        </div>
      </div>
      {canEdit && <p className="text-xs text-gray-500">اسحبي أي حدث إلى يوم آخر لإعادة جدولته، أو اضغطي على يوم لإضافة حدث.</p>}

      {flash && <div className={`rounded-lg p-3 text-sm ${flash.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{flash.text} <button className="mr-2 font-bold" onClick={() => setFlash(null)}>✕</button></div>}

      <div className="card overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7">
          {WEEKDAYS.map((d, i) => <div key={d} className={`border-b bg-gray-50 p-2 text-center text-xs font-bold ${i > 4 ? "text-gray-400" : "text-gray-600"}`}>{d}</div>)}
          {days.map((d, i) => {
            const key = dayKey(d);
            const inMonth = d.getUTCMonth() === month.getUTCMonth();
            const weekend = d.getUTCDay() > 4;
            const hol = holidayOf(d);
            const wk = d.getUTCDay() === 0 ? weekOf(d) : undefined;
            const evs = eventsByDay.get(key) ?? [];
            const droppable = canEdit && !weekend;
            return (
              <div key={key}
                className={`min-h-[112px] border-b border-l p-1.5 text-xs ${inMonth ? "" : "bg-gray-50/60 text-gray-400"} ${weekend ? "bg-gray-50" : ""} ${hol ? "bg-amber-50/70" : ""} ${key === today ? "ring-2 ring-inset ring-brand-400" : ""} ${dragOver === key ? "bg-brand-50" : ""} ${droppable ? "cursor-pointer" : ""}`}
                onClick={() => droppable && setAdding(key)}
                onDragOver={(e) => { if (droppable) { e.preventDefault(); setDragOver(key); } }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData("text/event-id"); if (id && droppable) move(id, key); }}>
                <div className="flex justify-between">
                  <span className="font-black">{d.getUTCDate()}</span>
                  <span className="text-[10px] text-gray-400">{formatHijriShort(d)}</span>
                </div>
                {wk && <div className="mt-0.5 rounded bg-brand-50 px-1 text-[10px] font-bold text-brand-700" title={wk.lessons.map((l) => l.title).join("\n")}>أسبوع {wk.number} · {wk.lessons.length} دروس</div>}
                {hol && <div className="mt-0.5 truncate text-[10px] font-bold text-amber-700">🏖️ {hol.title}</div>}
                <div className="mt-1 space-y-1">
                  {evs.map((e) => (
                    <div key={e.id} draggable={canEdit}
                      onDragStart={(ev) => ev.dataTransfer.setData("text/event-id", e.id)}
                      onClick={(ev) => { ev.stopPropagation(); setEdit(e); }}
                      className={`truncate rounded px-1.5 py-0.5 font-bold ${EVENT_TYPES[e.type].color} ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                      title={`${EVENT_TYPES[e.type].label}: ${e.title}${e.rescheduledFrom ? ` (أُعيدت جدولته من ${formatHijri(e.rescheduledFrom)})` : ""}`}>
                      {e.rescheduledFrom && "↪️ "}{e.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <WeekLessons weeks={data.weeks} />

      {(adding || edit) && (
        <EventDialog
          classId={classId}
          event={edit}
          date={adding ?? (edit ? dayKey(edit.date) : "")}
          canEdit={canEdit}
          onClose={() => { setAdding(null); setEdit(null); }}
          onSaved={(m) => { setAdding(null); setEdit(null); setFlash({ ok: true, text: m }); load(); }}
          onError={(e) => setFlash({ ok: false, text: (e as Error).message })}
        />
      )}
      <p className="sr-only">{label}</p>
    </div>
  );
}

function WeekLessons({ weeks }: { weeks: Wk[] }) {
  if (!weeks.length) return null;
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-black">دروس الخطة في هذا الشهر</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {weeks.map((w) => (
          <div key={w.id} className="rounded-lg bg-gray-50 p-3">
            <div className="mb-1 text-sm font-black">الأسبوع {w.number} <span className="text-xs font-normal text-gray-500">({formatHijriShort(w.start)})</span></div>
            <ul className="space-y-0.5 text-sm">
              {w.lessons.map((l) => <li key={l.id}>{l.status === "DONE" ? "✅" : l.status === "POSTPONED" ? "↪️" : "⏳"} {l.title} <span className="text-xs text-gray-400">· {l.kind}</span></li>)}
              {!w.lessons.length && <li className="text-gray-400">—</li>}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function EventDialog({ classId, event, date, canEdit, onClose, onSaved, onError }: {
  classId: string; event: Ev | null; date: string; canEdit: boolean;
  onClose: () => void; onSaved: (m: string) => void; onError: (e: unknown) => void;
}) {
  const [f, setF] = useState({ type: event?.type ?? ("QUIZ" as EventTypeName), title: event?.title ?? "", date, note: event?.note ?? "" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (event) await api(`/api/v1/events/${event.id}`, "PATCH", f);
      else await api(`/api/v1/classes/${classId}/events`, "POST", f);
      onSaved(event ? "تم حفظ الحدث" : "تمت إضافة الحدث");
    } catch (err) {
      onError(err);
    }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card w-full max-w-md space-y-3 p-5" role="dialog" aria-label="حدث">
        <h2 className="text-lg font-black">{event ? (canEdit ? "تعديل حدث" : "تفاصيل الحدث") : "حدث جديد"} — {formatHijri(f.date)}</h2>
        <fieldset disabled={!canEdit} className="space-y-3">
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as EventTypeName })} aria-label="النوع">
            {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input className="input" placeholder="العنوان" required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="التاريخ" />
          <textarea className="input" placeholder="ملاحظة (اختياري)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </fieldset>
        {event?.rescheduledFrom && <p className="text-xs text-gray-500">التاريخ الأصلي: {formatHijri(event.rescheduledFrom)}</p>}
        <div className="flex gap-2">
          {canEdit && <button className="btn-primary">حفظ</button>}
          {canEdit && event && (
            <button type="button" className="btn-danger" onClick={() => confirm("حذف الحدث؟") && api(`/api/v1/events/${event.id}`, "DELETE").then(() => onSaved("تم حذف الحدث"), onError)}>حذف</button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>إغلاق</button>
        </div>
      </form>
    </div>
  );
}
