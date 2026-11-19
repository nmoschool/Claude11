"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { AVATARS } from "@/lib/pictures";
import { BEHAVIOR_CATEGORIES, NOTE_KINDS } from "@/lib/behavior";
import { FILE_CATEGORIES, type FileCategory } from "@/lib/fileTypes";
import { formatHijri, formatWeekday, dayKey } from "@/lib/dates";

type Perms = { write: boolean; sensitive: boolean; behavior: boolean; files: boolean; supervisorNote: boolean; isSupervisor: boolean; privacy?: boolean };

const TABS = [
  { id: "info", label: "البيانات" },
  { id: "attendance", label: "الحضور" },
  { id: "behavior", label: "السلوك" },
  { id: "notes", label: "الملاحظات" },
  { id: "files", label: "الملفات" },
] as const;
const ATT = { PRESENT: ["حاضرة", "bg-mint-500"], LATE: ["متأخرة", "bg-amber-400"], ABSENT: ["غائبة", "bg-red-500"], EXCUSED: ["بعذر", "bg-sky-500"] } as const;

export default function StudentProfile({ profile, perms, initialTab }: { profile: any; perms: Perms; initialTab?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>(TABS.some((t) => t.id === initialTab) ? initialTab! : "info");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const s = profile.student;
  const ok = (text: string) => { setMsg({ ok: true, text }); router.refresh(); };
  const err = (e: unknown) => setMsg({ ok: false, text: (e as Error).message });
  const st = profile.attendance.stats;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <span className="text-5xl">{s.avatar}</span>
        <div className="flex-1">
          <h1 className="text-2xl font-black">{s.fullName} {s.archived && <span className="badge bg-gray-200 text-gray-600">مؤرشفة</span>}</h1>
          <p className="text-sm text-gray-500">الهوية: <span dir="ltr" className="font-mono">{s.nationalIdMasked}</span>{s.birthDate && <> · الميلاد: {formatHijri(s.birthDate)}</>}</p>
        </div>
        <Kpi label="نسبة الحضور" value={st.rate === null ? "—" : `${st.rate}%`} warn={st.rate !== null && st.rate < 90} />
        <Kpi label="غياب" value={st.ABSENT} warn={st.streak >= 3} sub={st.streak >= 3 ? `${st.streak} متتالية` : undefined} />
        <Kpi label="نقاط السلوك" value={profile.behavior.points} />
        <Kpi label="نقاط الألعاب" value={s.points} />
      </div>

      <nav className="flex gap-1 border-b border-gray-200" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold ${tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.label}
            {t.id === "notes" && profile.notes.length > 0 && <span className="mr-1 text-xs text-gray-400">({profile.notes.length})</span>}
            {t.id === "files" && profile.files.length > 0 && <span className="mr-1 text-xs text-gray-400">({profile.files.length})</span>}
          </button>
        ))}
      </nav>

      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{msg.text} <button className="mr-2 font-bold" onClick={() => setMsg(null)}>✕</button></div>}

      {tab === "info" && <InfoTab s={s} perms={perms} onOk={ok} onErr={err} />}
      {tab === "info" && perms.privacy && <PrivacyBox s={s} onErr={err} />}
      {tab === "attendance" && <AttendanceTab data={profile.attendance} />}
      {tab === "behavior" && <BehaviorTab id={s.id} data={profile.behavior} canEdit={perms.behavior} onOk={ok} onErr={err} />}
      {tab === "notes" && <NotesTab id={s.id} notes={profile.notes} perms={perms} onOk={ok} onErr={err} />}
      {tab === "files" && <FilesTab id={s.id} files={profile.files} perms={perms} onOk={ok} onErr={err} />}
    </div>
  );
}

function Kpi({ label, value, warn, sub }: { label: string; value: string | number; warn?: boolean; sub?: string }) {
  return (
    <div className={`min-w-[6.5rem] rounded-lg p-3 text-center ${warn ? "bg-red-50" : "bg-gray-50"}`}>
      <div className={`text-xl font-black ${warn ? "text-red-600" : ""}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="text-[10px] font-bold text-red-600">{sub}</div>}
    </div>
  );
}

function InfoTab({ s, perms, onOk, onErr }: { s: any; perms: Perms; onOk: (t: string) => void; onErr: (e: unknown) => void }) {
  const [f, setF] = useState({
    fullName: s.fullName, displayName: s.displayName, avatar: s.avatar,
    birthDate: s.birthDate ? dayKey(s.birthDate) : "", guardianName: s.guardianName ?? "",
    nationalId: perms.sensitive ? s.nationalId ?? "" : "", guardianPhone: perms.sensitive ? s.guardianPhone ?? "" : "", healthNotes: perms.sensitive ? s.healthNotes ?? "" : "",
  });
  const ro = !perms.write;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { fullName: f.fullName, displayName: f.displayName, avatar: f.avatar, birthDate: f.birthDate || null, guardianName: f.guardianName || null };
    if (perms.sensitive) Object.assign(body, { nationalId: f.nationalId || null, guardianPhone: f.guardianPhone || null, healthNotes: f.healthNotes || null });
    try { await api(`/api/v1/students/${s.id}`, "PATCH", body); onOk("تم حفظ البيانات"); } catch (e2) { onErr(e2); }
  }
  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <fieldset disabled={ro} className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2"><label className="label">الاسم الرباعي</label><input className="input" required minLength={3} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
        <div><label className="label">الاسم في شاشة الدخول</label><input className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></div>
        <div><label className="label">تاريخ الميلاد</label><input className="input" type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} /></div>
        <div><label className="label">اسم ولي الأمر</label><input className="input" value={f.guardianName} onChange={(e) => setF({ ...f, guardianName: e.target.value })} /></div>
        <div>
          <label className="label">الصورة الرمزية</label>
          <div className="flex flex-wrap gap-1">
            {AVATARS.map((a) => <button type="button" key={a} onClick={() => setF({ ...f, avatar: a })} className={`rounded-lg p-1 text-2xl ${f.avatar === a ? "bg-brand-100 ring-2 ring-brand-400" : ""}`} aria-label={a}>{a}</button>)}
          </div>
        </div>
      </fieldset>
      <fieldset disabled={ro || !perms.sensitive} className="grid gap-3 rounded-lg border border-dashed border-gray-200 p-3 md:grid-cols-3">
        <legend className="px-1 text-xs font-bold text-gray-500">🔒 بيانات حساسة (مشفّرة)</legend>
        {perms.sensitive ? (
          <>
            <div><label className="label">رقم الهوية</label><input className="input" dir="ltr" maxLength={10} value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value })} /></div>
            <div><label className="label">جوال ولي الأمر</label><input className="input" dir="ltr" placeholder="05xxxxxxxx" value={f.guardianPhone} onChange={(e) => setF({ ...f, guardianPhone: e.target.value })} /></div>
            <div><label className="label">ملاحظات صحية</label><input className="input" value={f.healthNotes} onChange={(e) => setF({ ...f, healthNotes: e.target.value })} /></div>
          </>
        ) : (
          <p className="text-sm text-gray-500 md:col-span-3">الهوية: <span dir="ltr">{s.nationalId}</span> · الجوال: {s.guardianPhone ?? "—"} · الصحة: {s.healthNotes ?? "—"}</p>
        )}
      </fieldset>
      {!ro && (
        <div className="flex gap-2">
          <button className="btn-primary">حفظ</button>
          <button type="button" className={s.archived ? "btn-secondary" : "btn-danger"}
            onClick={() => confirm(s.archived ? "استعادة الطالبة؟" : "أرشفة الطالبة؟ (لا تُحذف بياناتها ويمكن استعادتها)") &&
              api(`/api/v1/students/${s.id}`, "PATCH", { archived: !s.archived }).then(() => onOk(s.archived ? "تمت الاستعادة" : "تمت الأرشفة"), onErr)}>
            {s.archived ? "استعادة" : "أرشفة"}
          </button>
        </div>
      )}
    </form>
  );
}

function AttendanceTab({ data }: { data: any }) {
  const st = data.stats;
  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap gap-3 text-sm">
        {(Object.keys(ATT) as (keyof typeof ATT)[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${ATT[k][1]}`} />{ATT[k][0]}: <b>{st[k] ?? 0}</b></span>
        ))}
        <span className="text-gray-500">· إجمالي الأيام المسجلة: {st.total}</span>
      </div>
      <div className="flex flex-wrap gap-1" role="img" aria-label="خريطة الحضور">
        {[...data.records].reverse().map((r: any) => (
          <span key={r.id} title={`${formatWeekday(r.date)} ${formatHijri(r.date)}: ${ATT[r.status as keyof typeof ATT][0]}${r.note ? ` — ${r.note}` : ""}`}
            className={`h-5 w-5 rounded ${ATT[r.status as keyof typeof ATT][1]}`} />
        ))}
      </div>
      <table className="table">
        <thead><tr><th>التاريخ</th><th>الحالة</th><th>ملاحظة</th></tr></thead>
        <tbody>
          {data.records.filter((r: any) => r.status !== "PRESENT").map((r: any) => (
            <tr key={r.id}><td>{formatWeekday(r.date)} {formatHijri(r.date)}</td><td>{ATT[r.status as keyof typeof ATT][0]}</td><td className="text-gray-500">{r.note ?? ""}</td></tr>
          ))}
          {!data.records.some((r: any) => r.status !== "PRESENT") && <tr><td colSpan={3} className="text-center text-gray-400">لا غياب أو تأخر مسجّل 🌟</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function BehaviorTab({ id, data, canEdit, onOk, onErr }: { id: string; data: any; canEdit: boolean; onOk: (t: string) => void; onErr: (e: unknown) => void }) {
  const [f, setF] = useState({ category: BEHAVIOR_CATEGORIES[0], positive: true, points: 1, note: "" });
  return (
    <div className="card space-y-4 p-5">
      <p className="text-sm">إيجابي: <b className="text-mint-700">{data.positive}</b> · يحتاج متابعة: <b className="text-red-600">{data.negative}</b> · صافي النقاط: <b>{data.points}</b></p>
      {canEdit && (
        <form className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3"
          onSubmit={(e) => { e.preventDefault(); api(`/api/v1/students/${id}/behavior`, "POST", { ...f, note: f.note || null }).then(() => { setF({ ...f, note: "" }); onOk("تم التسجيل"); }, onErr); }}>
          <div className="flex gap-1">
            <button type="button" className={f.positive ? "btn-primary" : "btn-secondary"} onClick={() => setF({ ...f, positive: true })}>👍 إيجابي</button>
            <button type="button" className={!f.positive ? "btn-danger" : "btn-secondary"} onClick={() => setF({ ...f, positive: false })}>✋ يحتاج متابعة</button>
          </div>
          <select className="input w-auto" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="الفئة">{BEHAVIOR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <input className="input w-20" type="number" min={0} max={10} value={f.points} onChange={(e) => setF({ ...f, points: Number(e.target.value) })} aria-label="النقاط" />
          <input className="input w-64" placeholder="ملاحظة (اختياري)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <button className="btn-primary">تسجيل</button>
        </form>
      )}
      <ul className="divide-y">
        {data.records.map((b: any) => (
          <li key={b.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="text-xl">{b.positive ? "👍" : "✋"}</span>
            <div className="flex-1"><b>{b.category}</b> <span className={b.positive ? "text-mint-700" : "text-red-600"}>({b.positive ? "+" : "−"}{b.points})</span>{b.note && <span className="text-gray-600"> — {b.note}</span>}
              <div className="text-xs text-gray-400">{formatHijri(b.date)} · {b.recordedByName}</div></div>
            {canEdit && <button className="text-xs text-red-600" onClick={() => confirm("حذف السجل؟") && api(`/api/v1/behavior/${b.id}`, "DELETE").then(() => onOk("تم الحذف"), onErr)}>حذف</button>}
          </li>
        ))}
        {!data.records.length && <li className="py-4 text-center text-gray-400">لا سجلات سلوك.</li>}
      </ul>
    </div>
  );
}

function NotesTab({ id, notes, perms, onOk, onErr }: { id: string; notes: any[]; perms: Perms; onOk: (t: string) => void; onErr: (e: unknown) => void }) {
  const kinds = perms.isSupervisor ? (["SUPERVISOR"] as const) : (["ACADEMIC", "GUARDIAN_CONTACT", "REMEDIAL"] as const);
  const canAdd = perms.isSupervisor ? perms.supervisorNote : perms.behavior;
  const [f, setF] = useState({ kind: kinds[0] as string, body: "", visibleToSupervisor: true });
  return (
    <div className="card space-y-4 p-5">
      {canAdd && (
        <form className="space-y-2 rounded-lg bg-gray-50 p-3"
          onSubmit={(e) => { e.preventDefault(); api(`/api/v1/students/${id}/notes`, "POST", f).then(() => { setF({ ...f, body: "" }); onOk("تمت إضافة الملاحظة"); }, onErr); }}>
          <div className="flex flex-wrap gap-2">
            <select className="input w-auto" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="نوع الملاحظة">
              {kinds.map((k) => <option key={k} value={k}>{NOTE_KINDS[k]}</option>)}
            </select>
            {!perms.isSupervisor && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.visibleToSupervisor} onChange={(e) => setF({ ...f, visibleToSupervisor: e.target.checked })} /> تظهر للمشرفة</label>}
          </div>
          <textarea className="input min-h-[80px]" required minLength={2} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="نص الملاحظة" />
          <button className="btn-primary">إضافة</button>
        </form>
      )}
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className={`rounded-lg p-3 ${n.kind === "SUPERVISOR" ? "bg-amber-50" : n.kind === "REMEDIAL" ? "bg-accent-50" : "bg-gray-50"}`}>
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className="badge bg-white text-gray-700">{NOTE_KINDS[n.kind as keyof typeof NOTE_KINDS]}</span>
              {!n.visibleToSupervisor && <span className="badge bg-white text-gray-500">🔒 خاصة</span>}
              <span className="text-gray-500">{n.authorName} · {formatHijri(n.createdAt)}</span>
              {n.mine && <button className="mr-auto text-red-600" onClick={() => confirm("حذف الملاحظة؟") && api(`/api/v1/notes/${n.id}`, "DELETE").then(() => onOk("تم الحذف"), onErr)}>حذف</button>}
            </div>
            <p className="whitespace-pre-wrap text-sm">{n.body}</p>
          </li>
        ))}
        {!notes.length && <li className="text-center text-gray-400">لا ملاحظات.</li>}
      </ul>
    </div>
  );
}

function FilesTab({ id, files, perms, onOk, onErr }: { id: string; files: any[]; perms: Perms; onOk: (t: string) => void; onErr: (e: unknown) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<FileCategory>("WORK");
  const [busy, setBusy] = useState(false);
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return onErr(new Error("الحد الأقصى 10 ميجابايت"));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    setBusy(true);
    try { await api(`/api/v1/students/${id}/files`, "POST", fd); setFile(null); (e.target as HTMLFormElement).reset(); onOk("تم رفع الملف"); } catch (e2) { onErr(e2); } finally { setBusy(false); }
  }
  const icon = (m: string) => (m.startsWith("image/") ? "🖼️" : m.startsWith("audio/") ? "🎧" : "📄");
  return (
    <div className="card space-y-4 p-5">
      {perms.files && (
        <form onSubmit={upload} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.mp3,.m4a" aria-label="الملف" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value as FileCategory)} aria-label="التصنيف">
            {(Object.keys(FILE_CATEGORIES) as FileCategory[]).filter((k) => k !== "MEDICAL" || perms.sensitive).map((k) => <option key={k} value={k}>{FILE_CATEGORIES[k]}</option>)}
          </select>
          <button className="btn-primary" disabled={!file || busy}>{busy ? "..." : "رفع"}</button>
          <span className="text-xs text-gray-500">PDF، صور، صوت — حتى 10 ميجابايت. تُزال بيانات الموقع من الصور تلقائياً.</span>
        </form>
      )}
      <ul className="divide-y">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="text-2xl">{icon(f.mime)}</span>
            <div className="flex-1">
              <a className="font-bold hover:text-brand-700 hover:underline" href={`/api/v1/files/${f.id}`}>{f.fileName}</a>
              <div className="text-xs text-gray-400">{FILE_CATEGORIES[f.category as FileCategory]} · {(f.size / 1024).toFixed(0)} ك.ب · {f.uploadedByName} · {formatHijri(f.createdAt)}</div>
              {f.mime.startsWith("audio/") && <audio controls preload="none" src={`/api/v1/files/${f.id}?inline=1`} className="mt-1 h-8" />}
            </div>
            {perms.files && <button className="text-xs text-red-600" onClick={() => confirm("حذف الملف نهائياً؟") && api(`/api/v1/files/${f.id}`, "DELETE").then(() => onOk("تم حذف الملف"), onErr)}>حذف</button>}
          </li>
        ))}
        {!files.length && <li className="py-4 text-center text-gray-400">لا ملفات.</li>}
      </ul>
    </div>
  );
}

function PrivacyBox({ s, onErr }: { s: any; onErr: (e: unknown) => void }) {
  async function erase() {
    const name = prompt(`حذف نهائي لا يمكن التراجع عنه.\nاكتبي الاسم الكامل للتأكيد:\n${s.fullName}`);
    if (!name) return;
    const reason = prompt("سبب الحذف (طلب ولي الأمر، انتقال...):");
    if (!reason) return;
    try {
      await api(`/api/v1/students/${s.id}/erase`, "POST", { confirmName: name, reason });
      window.location.href = `/dashboard/classes/${s.classId}?archived=1`;
    } catch (e) {
      onErr(e);
    }
  }
  return (
    <div className="card space-y-2 border-dashed p-5">
      <h3 className="font-black">🔐 حقوق صاحب البيانات (نظام حماية البيانات الشخصية)</h3>
      <p className="text-sm text-gray-500">للاستجابة لطلب ولي الأمر: تصدير كل بيانات الطالبة، أو حذفها نهائياً بعد أرشفتها.</p>
      <div className="flex gap-2">
        <a className="btn-secondary" href={`/api/v1/students/${s.id}/export`}>⬇️ تصدير البيانات (JSON)</a>
        <button className="btn-danger" disabled={!s.archived} title={s.archived ? "" : "أرشفي الطالبة أولاً"} onClick={erase}>حذف نهائي</button>
      </div>
    </div>
  );
}
