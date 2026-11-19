"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { LESSON_KINDS, LESSON_STATUS, type LessonKindName } from "@/lib/curriculum";
import { formatGregorian, formatHijri, formatHijriShort } from "@/lib/dates";

interface Lesson {
  id: string;
  unitId: string;
  order: number;
  title: string;
  kind: LessonKindName;
  periods: number;
  objectives: string[];
  status: keyof typeof LESSON_STATUS;
  weekId: string | null;
  skills: { code: string; title: string }[];
}
interface Plan {
  term: { id: string; title: string; startDate: string; endDate: string };
  weeks: { id: string; number: number; start: string; end: string; holiday: boolean }[];
  holidays: { id: string; title: string; start: string; end: string }[];
  units: { id: string; order: number; title: string; lessons: Lesson[] }[];
  coverage: { currentWeekNumber: number | null; due: number; done: number; total: number; doneTotal: number; percent: number };
}
interface Skill {
  code: string;
  title: string;
  domain: string;
}

const KIND_COLORS: Record<LessonKindName, string> = {
  READING: "border-brand-300 bg-brand-50",
  LISTENING: "border-sky-300 bg-sky-50",
  LEXICAL: "border-amber-300 bg-amber-50",
  GRAMMAR: "border-orange-300 bg-orange-50",
  SPELLING: "border-accent-300 bg-accent-50",
  HANDWRITING: "border-mint-500 bg-mint-50",
  WRITING: "border-violet-300 bg-violet-50",
  SPEAKING: "border-lime-300 bg-lime-50",
  REVIEW: "border-gray-300 bg-gray-50",
};
const STATUS_ICON = { PLANNED: "⏳", DONE: "✅", POSTPONED: "↪️" };

export default function CurriculumBoard({ initial, terms, skills, canEdit }: { initial: Plan; terms: { id: string; title: string }[]; skills: Skill[]; canEdit: boolean }) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(initial);
  const [editing, setEditing] = useState<Lesson | "new" | null>(null);
  const [panel, setPanel] = useState<"import" | "holidays" | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [filterKind, setFilterKind] = useState<string>("");

  const lessons = useMemo(() => plan.units.flatMap((u) => u.lessons.map((l) => ({ ...l, unitTitle: u.title, unitOrder: u.order }))), [plan]);
  const byWeek = useMemo(() => {
    const m = new Map<string, typeof lessons>();
    for (const l of lessons) {
      if (filterKind && l.kind !== filterKind) continue;
      const k = l.weekId ?? "none";
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    for (const v of m.values()) v.sort((a, b) => a.unitOrder - b.unitOrder || a.order - b.order);
    return m;
  }, [lessons, filterKind]);

  async function reload(msg?: string) {
    const p = await api<Plan>(`/api/v1/terms/${plan.term.id}/plan`);
    setPlan(p);
    if (msg) setFlash({ ok: true, text: msg });
  }
  const fail = (e: unknown) => setFlash({ ok: false, text: (e as Error).message });

  const c = plan.coverage;
  const behind = c.due - c.done;

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">توزيع المنهج</h1>
          <p className="text-sm text-gray-500">
            {formatHijri(plan.term.startDate)} — {formatHijri(plan.term.endDate)} · {plan.weeks.length} أسبوعاً
            {c.currentWeekNumber && <> · <b>الأسبوع الحالي: {c.currentWeekNumber}</b></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={plan.term.id} onChange={(e) => router.push(`/dashboard/curriculum?term=${e.target.value}`)} aria-label="الفصل الدراسي">
            {terms.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <select className="input w-auto" value={filterKind} onChange={(e) => setFilterKind(e.target.value)} aria-label="تصفية حسب المكوّن">
            <option value="">كل المكوّنات</option>
            {Object.entries(LESSON_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {canEdit && <button className="btn-primary" onClick={() => setEditing("new")}>＋ درس</button>}
          {canEdit && <button className="btn-secondary" onClick={() => setPanel(panel === "import" ? null : "import")}>📥 استيراد</button>}
          <button className="btn-secondary" onClick={() => setPanel(panel === "holidays" ? null : "holidays")}>🏖️ الإجازات</button>
          <a className="btn-secondary" href="/api/v1/curriculum/template">قالب Excel</a>
          <button className="btn-secondary" onClick={() => window.print()}>🖨️ طباعة</button>
        </div>
      </div>

      <div className="hidden text-center print:block">
        <h1 className="text-xl font-black">توزيع منهج لغتي — الصف الرابع — {plan.term.title}</h1>
      </div>

      {flash && (
        <div className={`no-print rounded-lg p-3 text-sm ${flash.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">
          {flash.text} <button className="mr-2 font-bold" onClick={() => setFlash(null)}>✕</button>
        </div>
      )}

      <div className="card no-print grid gap-4 p-5 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-bold">التغطية حتى الأسبوع الحالي</span>
            <span className="font-black">{c.percent}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="نسبة تغطية المنهج" aria-valuenow={c.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${c.percent >= 90 ? "bg-mint-500" : c.percent >= 70 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${c.percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500">{c.done} منفّذ من {c.due} مخطط حتى الآن{behind > 0 && <b className="text-red-600"> · متأخر {behind} درس</b>}</p>
        </div>
        <Stat label="إجمالي الدروس" value={c.total} />
        <Stat label="المنفّذ من الفصل" value={`${c.doneTotal}/${c.total}`} />
      </div>

      {panel === "import" && canEdit && <ImportPanel termId={plan.term.id} onDone={(m) => { setPanel(null); reload(m); }} onError={fail} />}
      {panel === "holidays" && <HolidaysPanel plan={plan} canEdit={canEdit} onChange={(m) => reload(m)} onError={fail} />}

      <div className="space-y-3">
        {plan.weeks.map((w) => {
          const items = byWeek.get(w.id) ?? [];
          const current = w.number === c.currentWeekNumber;
          return (
            <section key={w.id} className={`card break-inside-avoid p-4 ${current ? "ring-2 ring-brand-300" : ""} ${w.holiday ? "bg-gray-50" : ""}`}>
              <header className="mb-2 flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-black">الأسبوع {w.number}</h2>
                <span className="text-xs text-gray-500">{formatHijriShort(w.start)} – {formatHijri(w.end)} · {formatGregorian(w.start)}</span>
                {current && <span className="badge bg-brand-100 text-brand-700">الأسبوع الحالي</span>}
                {w.holiday && <span className="badge bg-gray-200 text-gray-600">إجازة</span>}
                <span className="mr-auto text-xs text-gray-400">{items.reduce((s, l) => s + l.periods, 0)} حصة</span>
              </header>
              {items.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((l) => (
                    <button key={l.id} disabled={!canEdit} onClick={() => setEditing(l)}
                      className={`rounded-lg border-r-4 p-2.5 text-right text-sm transition enabled:hover:shadow ${KIND_COLORS[l.kind]}`}>
                      <div className="flex items-start gap-1.5 font-bold">
                        <span role="img" aria-label={LESSON_STATUS[l.status]}>{STATUS_ICON[l.status]}</span>
                        <span>{l.title}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-600">{LESSON_KINDS[l.kind]} · {l.unitTitle} · {l.periods} حصة</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">{w.holiday ? "لا دروس في أسبوع الإجازة" : "لا دروس مجدولة"}</p>
              )}
            </section>
          );
        })}
        {(byWeek.get("none") ?? []).length > 0 && (
          <section className="card border-dashed p-4">
            <h2 className="mb-2 font-black text-gray-500">دروس غير مجدولة</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {byWeek.get("none")!.map((l) => (
                <button key={l.id} disabled={!canEdit} onClick={() => setEditing(l)} className={`rounded-lg border-r-4 p-2.5 text-right text-sm ${KIND_COLORS[l.kind]}`}>{l.title}</button>
              ))}
            </div>
          </section>
        )}
      </div>

      {editing && canEdit && (
        <LessonEditor
          lesson={editing === "new" ? null : editing}
          plan={plan}
          skills={skills}
          onClose={() => setEditing(null)}
          onSaved={(m) => { setEditing(null); reload(m); }}
          onError={fail}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center">
      <div className="text-xl font-black">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function LessonEditor({ lesson, plan, skills, onClose, onSaved, onError }: {
  lesson: Lesson | null;
  plan: Plan;
  skills: Skill[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (e: unknown) => void;
}) {
  const [f, setF] = useState({
    title: lesson?.title ?? "",
    kind: lesson?.kind ?? ("READING" as LessonKindName),
    periods: lesson?.periods ?? 1,
    objectives: (lesson?.objectives ?? []).join("\n"),
    skillCodes: lesson?.skills.map((s) => s.code) ?? [],
    unitId: lesson?.unitId ?? plan.units[0]?.id ?? "",
    weekId: lesson?.weekId ?? "",
  });
  const [newUnit, setNewUnit] = useState("");
  const [toWeek, setToWeek] = useState("");
  const [shift, setShift] = useState(true);
  const [preview, setPreview] = useState<{ moves: { lessonId: string }[]; overflow: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const titleOf = (id: string) => plan.units.flatMap((u) => u.lessons).find((l) => l.id === id)?.title ?? id;
  const teachWeeks = plan.weeks.filter((w) => !w.holiday);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      onSaved(msg);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      title: f.title,
      kind: f.kind,
      periods: Number(f.periods),
      objectives: f.objectives.split("\n").map((s) => s.trim()).filter(Boolean),
      skillCodes: f.skillCodes,
      weekId: f.weekId || null,
    };
    await run(async () => {
      let unitId = f.unitId;
      if (unitId === "__new") unitId = (await api(`/api/v1/terms/${plan.term.id}/units`, "POST", { title: newUnit })).id;
      if (lesson) await api(`/api/v1/lessons/${lesson.id}`, "PATCH", { ...body, unitId });
      else await api(`/api/v1/units/${unitId}/lessons`, "POST", body);
    }, lesson ? "تم حفظ الدرس" : "تمت إضافة الدرس");
  }

  async function previewMove() {
    if (!lesson || !toWeek) return;
    try {
      setPreview(await api(`/api/v1/lessons/${lesson.id}/reschedule`, "POST", { toWeekId: toWeek, shiftFollowing: shift, dryRun: true }));
    } catch (e) {
      onError(e);
    }
  }

  return (
    <div className="no-print fixed inset-0 z-40 flex justify-start bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="تحرير الدرس">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{lesson ? "تحرير الدرس" : "درس جديد"}</h2>
          <button className="btn-secondary" onClick={onClose}>إغلاق</button>
        </div>

        {lesson && (
          <div className="mb-5 flex gap-2">
            {(Object.keys(LESSON_STATUS) as (keyof typeof LESSON_STATUS)[]).map((s) => (
              <button key={s} disabled={busy || lesson.status === s} className={lesson.status === s ? "btn-primary" : "btn-secondary"}
                onClick={() => run(() => api(`/api/v1/lessons/${lesson.id}`, "PATCH", { status: s }), `الحالة: ${LESSON_STATUS[s]}`)}>
                {STATUS_ICON[s]} {LESSON_STATUS[s]}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={save} className="space-y-3">
          <div><label className="label">عنوان الدرس</label><input className="input" required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">المكوّن</label>
              <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as LessonKindName })}>
                {Object.entries(LESSON_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="label">عدد الحصص</label><input className="input" type="number" min={1} max={10} value={f.periods} onChange={(e) => setF({ ...f, periods: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">الوحدة</label>
              <select className="input" value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })}>
                {plan.units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
                <option value="__new">＋ وحدة جديدة…</option>
              </select>
              {f.unitId === "__new" && <input className="input mt-2" placeholder="اسم الوحدة" required value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />}
            </div>
            {!lesson && (
              <div>
                <label className="label">الأسبوع</label>
                <select className="input" value={f.weekId} onChange={(e) => setF({ ...f, weekId: e.target.value })}>
                  <option value="">غير مجدول</option>
                  {teachWeeks.map((w) => <option key={w.id} value={w.id}>الأسبوع {w.number}</option>)}
                </select>
              </div>
            )}
          </div>
          <div><label className="label">الأهداف (هدف في كل سطر)</label><textarea className="input min-h-[80px]" value={f.objectives} onChange={(e) => setF({ ...f, objectives: e.target.value })} /></div>
          <div>
            <label className="label">المهارات المستهدفة</label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-2">
              {skills.map((s) => (
                <label key={s.code} className="flex items-center gap-2 py-0.5 text-sm">
                  <input type="checkbox" checked={f.skillCodes.includes(s.code)}
                    onChange={(e) => setF({ ...f, skillCodes: e.target.checked ? [...f.skillCodes, s.code] : f.skillCodes.filter((x) => x !== s.code) })} />
                  {s.title} <span className="text-xs text-gray-400">({s.domain})</span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary" disabled={busy}>حفظ</button>
        </form>

        {lesson && (
          <section className="mt-6 space-y-3 border-t pt-4">
            <h3 className="font-black">إعادة الجدولة</h3>
            <p className="text-xs text-gray-500">الأسبوع الحالي للدرس: {plan.weeks.find((w) => w.id === lesson.weekId)?.number ?? "غير مجدول"} · أسابيع الإجازة مستبعدة تلقائياً.</p>
            <select className="input" value={toWeek} onChange={(e) => { setToWeek(e.target.value); setPreview(null); }} aria-label="الأسبوع الجديد">
              <option value="">اختاري الأسبوع الجديد…</option>
              {teachWeeks.map((w) => <option key={w.id} value={w.id}>الأسبوع {w.number} ({formatHijriShort(w.start)})</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shift} onChange={(e) => { setShift(e.target.checked); setPreview(null); }} /> إزاحة الدروس التالية تلقائياً بنفس المقدار</label>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={!toWeek} onClick={previewMove}>معاينة</button>
              <button className="btn-primary" disabled={!toWeek || busy}
                onClick={() => run(() => api(`/api/v1/lessons/${lesson.id}/reschedule`, "POST", { toWeekId: toWeek, shiftFollowing: shift }), "تمت إعادة الجدولة")}>تطبيق</button>
              <button className="btn-accent" disabled={busy || !lesson.weekId} title="تأجيل لأسبوع الدراسة التالي مع إزاحة ما بعده"
                onClick={() => {
                  const i = teachWeeks.findIndex((w) => w.id === lesson.weekId);
                  const next = teachWeeks[i + 1] ?? teachWeeks.find((w) => (plan.weeks.find((x) => x.id === lesson.weekId)?.number ?? 0) < w.number);
                  if (!next) return onError(new Error("لا يوجد أسبوع دراسي بعده"));
                  run(() => api(`/api/v1/lessons/${lesson.id}/reschedule`, "POST", { toWeekId: next.id, shiftFollowing: true, markPostponed: true }), "تم التأجيل أسبوعاً وإزاحة الدروس التالية");
                }}>↪️ تأجيل أسبوع</button>
            </div>
            {preview && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p>سيتحرك <b>{preview.moves.length}</b> درس.</p>
                {preview.overflow.length > 0 && (
                  <p className="mt-1 text-red-600">⚠️ {preview.overflow.length} درس سيتجاوز نهاية الفصل ويوضع في آخر أسبوع: {preview.overflow.map(titleOf).join("، ")}</p>
                )}
              </div>
            )}
            <button className="btn-danger mt-4" disabled={busy}
              onClick={() => confirm("حذف الدرس نهائياً؟") && run(() => api(`/api/v1/lessons/${lesson.id}`, "DELETE"), "تم حذف الدرس")}>حذف الدرس</button>
          </section>
        )}
      </aside>
    </div>
  );
}

function ImportPanel({ termId, onDone, onError }: { termId: string; onDone: (m: string) => void; onError: (e: unknown) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("replace");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function send(dryRun: boolean) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    if (dryRun) fd.append("dryRun", "1");
    setBusy(true);
    try {
      const r = await api(`/api/v1/terms/${termId}/import`, "POST", fd);
      if (dryRun) setPreview(r);
      else onDone(`تم استيراد ${r.total} درس في ${r.units.length} وحدة`);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card no-print space-y-3 p-5">
      <h2 className="font-black">استيراد التوزيع من Excel / CSV</h2>
      <p className="text-sm text-gray-500">نزّلي «قالب Excel» واملئيه بالتوزيع الرسمي (أو ارفعي ملفاً بنفس الأعمدة). الخلية الفارغة في عمود الوحدة تعني نفس الوحدة السابقة.</p>
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} aria-label="ملف التوزيع" />
        <label className="flex items-center gap-1 text-sm"><input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> استبدال التوزيع الحالي</label>
        <label className="flex items-center gap-1 text-sm"><input type="radio" checked={mode === "append"} onChange={() => setMode("append")} /> إضافة إليه</label>
        <button className="btn-secondary" disabled={!file || busy} onClick={() => send(true)}>معاينة</button>
      </div>
      {preview && (
        <>
          <p className="text-sm">صفوف صالحة: <b>{preview.valid}</b> من {preview.total} · الوحدات: {preview.units.join("، ")}</p>
          <div className="max-h-72 overflow-auto rounded border">
            <table className="table">
              <thead><tr><th>صف</th><th>أسبوع</th><th>الوحدة</th><th>الدرس</th><th>المكوّن</th><th>الملاحظات</th></tr></thead>
              <tbody>
                {preview.rows.map((r: any) => (
                  <tr key={r.row} className={r.errors.length ? "bg-red-50" : ""}>
                    <td>{r.row}</td><td>{r.week ?? "—"}</td><td>{r.unit}</td><td>{r.title}</td><td>{r.kind ? LESSON_KINDS[r.kind as LessonKindName] : "—"}</td>
                    <td className="text-xs text-red-600">{r.errors.join("؛ ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary" disabled={busy || preview.valid !== preview.total}
            onClick={() => (mode !== "replace" || confirm("سيُحذف التوزيع الحالي لهذا الفصل الدراسي ويُستبدل. متابعة؟")) && send(false)}>
            تأكيد الاستيراد
          </button>
          {preview.valid !== preview.total && <p className="text-xs text-red-600">صحّحي الصفوف المظللة بالأحمر في الملف ثم أعيدي المعاينة.</p>}
        </>
      )}
    </div>
  );
}

function HolidaysPanel({ plan, canEdit, onChange, onError }: { plan: Plan; canEdit: boolean; onChange: (m: string) => void; onError: (e: unknown) => void }) {
  const [f, setF] = useState({ title: "", start: "", end: "" });
  return (
    <div className="card no-print space-y-3 p-5">
      <h2 className="font-black">الإجازات</h2>
      <ul className="space-y-1 text-sm">
        {plan.holidays.map((h) => (
          <li key={h.id} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2">
            <span><b>{h.title}</b> · {formatHijri(h.start)}{h.end !== h.start && ` – ${formatHijri(h.end)}`}</span>
            {canEdit && <button className="text-xs text-red-600" onClick={() => confirm("حذف الإجازة؟") && api(`/api/v1/holidays/${h.id}`, "DELETE").then(() => onChange("تم حذف الإجازة"), onError)}>حذف</button>}
          </li>
        ))}
        {!plan.holidays.length && <li className="text-gray-400">لا إجازات مسجلة.</li>}
      </ul>
      {canEdit && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); api(`/api/v1/terms/${plan.term.id}/holidays`, "POST", f).then(() => { setF({ title: "", start: "", end: "" }); onChange("تمت إضافة الإجازة — الأسبوع الذي تغطيه بالكامل يُعامل كأسبوع إجازة"); }, onError); }}>
          <div><label className="label">الاسم</label><input className="input" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><label className="label">من</label><input className="input" type="date" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value, end: f.end || e.target.value })} /></div>
          <div><label className="label">إلى</label><input className="input" type="date" required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
          <button className="btn-primary">إضافة</button>
        </form>
      )}
      <p className="text-xs text-gray-400">ملاحظة: إضافة إجازة لا تنقل الدروس تلقائياً؛ استخدمي «تأجيل أسبوع» على أول درس متأثر لإزاحة ما بعده.</p>
    </div>
  );
}
