"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";

const FIELD_LABELS: Record<string, string> = {
  fullName: "اسم الطالبة",
  nationalId: "رقم الهوية",
  birthDate: "تاريخ الميلاد",
  guardianName: "اسم ولي الأمر",
  guardianPhone: "جوال ولي الأمر",
};
const ACTIONS: Record<string, { label: string; cls: string }> = {
  create: { label: "جديدة", cls: "bg-mint-50 text-mint-700" },
  update: { label: "تحديث", cls: "bg-sky-50 text-sky-700" },
  skip: { label: "تخطٍّ", cls: "bg-gray-100 text-gray-500" },
  conflict: { label: "تعارض", cls: "bg-amber-50 text-amber-700" },
  error: { label: "خطأ", cls: "bg-red-50 text-red-700" },
};

export default function StudentTools({ classId, canImport, canSensitive }: { classId: string; canImport: boolean; canSensitive: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "import" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="no-print space-y-3">
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => setMode(mode === "add" ? null : "add")}>＋ طالبة</button>
        {canImport && <button className="btn-secondary" onClick={() => setMode(mode === "import" ? null : "import")}>📥 استيراد من «نور» / Excel</button>}
      </div>
      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</div>}
      {mode === "add" && (
        <AddStudent classId={classId} canSensitive={canSensitive}
          onDone={(t) => { setMode(null); setMsg({ ok: true, text: t }); router.refresh(); }}
          onError={(t) => setMsg({ ok: false, text: t })} />
      )}
      {mode === "import" && (
        <ImportStudents classId={classId}
          onDone={(t) => { setMode(null); setMsg({ ok: true, text: t }); router.refresh(); }}
          onError={(t) => setMsg({ ok: false, text: t })} />
      )}
    </div>
  );
}

function AddStudent({ classId, canSensitive, onDone, onError }: { classId: string; canSensitive: boolean; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [f, setF] = useState({ fullName: "", nationalId: "", birthDate: "", guardianName: "", guardianPhone: "" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/v1/classes/${classId}/students`, "POST", {
        fullName: f.fullName,
        birthDate: f.birthDate || null,
        guardianName: f.guardianName || null,
        ...(canSensitive ? { nationalId: f.nationalId || null, guardianPhone: f.guardianPhone || null } : {}),
      });
      onDone("تمت إضافة الطالبة. ولّدي لها رمز دخول من «بطاقات دخول الطالبات».");
    } catch (err) {
      onError((err as Error).message);
    }
  }
  return (
    <form onSubmit={submit} className="card grid gap-3 p-5 md:grid-cols-3">
      <div className="md:col-span-2"><label className="label">الاسم الرباعي</label><input className="input" required minLength={3} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
      <div><label className="label">تاريخ الميلاد</label><input className="input" type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} /></div>
      {canSensitive && <div><label className="label">رقم الهوية</label><input className="input" dir="ltr" inputMode="numeric" maxLength={10} value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value })} /></div>}
      <div><label className="label">اسم ولي الأمر</label><input className="input" value={f.guardianName} onChange={(e) => setF({ ...f, guardianName: e.target.value })} /></div>
      {canSensitive && <div><label className="label">جوال ولي الأمر</label><input className="input" dir="ltr" placeholder="05xxxxxxxx" value={f.guardianPhone} onChange={(e) => setF({ ...f, guardianPhone: e.target.value })} /></div>}
      <div className="md:col-span-3"><button className="btn-primary">إضافة</button></div>
    </form>
  );
}

function ImportStudents({ classId, onDone, onError }: { classId: string; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function send(dryRun: boolean, map?: Record<string, string>) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    if (map) fd.append("mapping", JSON.stringify(Object.fromEntries(Object.entries(map).filter(([, v]) => v))));
    if (dryRun) fd.append("dryRun", "1");
    setBusy(true);
    try {
      const r = await api(`/api/v1/classes/${classId}/students/import`, "POST", fd);
      if (dryRun) {
        setPreview(r);
        setMapping(r.mapping);
      } else onDone(`تم الاستيراد: ${r.counts.create ?? 0} جديدة، ${r.counts.update ?? 0} محدّثة، ${(r.counts.skip ?? 0) + (r.counts.conflict ?? 0) + (r.counts.error ?? 0)} لم تُستورد`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const importable = preview ? (preview.counts.create ?? 0) + (preview.counts.update ?? 0) : 0;

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="font-black">استيراد الطالبات</h2>
        <p className="text-sm text-gray-500">
          من نظام «نور»: صدّري كشف أسماء الفصل بصيغة Excel ثم ارفعيه هنا. تُطابق الطالبات برقم الهوية فلا تتكرر؛
          الموجودة تُستكمل بياناتها الناقصة فقط. تواريخ الميلاد الهجرية لا تُستورد حالياً (أدخليها يدوياً).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".xlsx,.csv" aria-label="ملف الطالبات" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
        <button className="btn-secondary" disabled={!file || busy} onClick={() => send(true)}>معاينة</button>
      </div>

      {preview && (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            {Object.entries(FIELD_LABELS).map(([k, label]) => (
              <div key={k}>
                <label className="label">{label}</label>
                <select className="input" value={mapping[k] ?? ""} onChange={(e) => setMapping({ ...mapping, [k]: e.target.value })}>
                  <option value="">— لا شيء —</option>
                  {preview.headers.map((h: string) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button className="btn-secondary" disabled={busy} onClick={() => send(true, mapping)}>إعادة المعاينة بهذه المطابقة</button>

          <div className="flex flex-wrap gap-2 text-sm">
            {Object.entries(preview.counts as Record<string, number>).map(([k, v]) => <span key={k} className={`badge ${ACTIONS[k].cls}`}>{ACTIONS[k].label}: {v}</span>)}
          </div>
          <div className="max-h-80 overflow-auto rounded border">
            <table className="table">
              <thead><tr><th>صف</th><th>الإجراء</th><th>الاسم</th><th>الهوية</th><th>الجوال</th><th>الميلاد</th><th>ملاحظات</th></tr></thead>
              <tbody>
                {preview.rows.map((r: any) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td><span className={`badge ${ACTIONS[r.action].cls}`}>{ACTIONS[r.action].label}</span></td>
                    <td>{r.fullName || "—"}</td>
                    <td dir="ltr" className="text-right font-mono text-xs">{r.nationalId ?? "—"}</td>
                    <td dir="ltr" className="text-right">{r.guardianPhone ?? "—"}</td>
                    <td>{r.birthDate ?? "—"}</td>
                    <td className="text-xs"><span className="text-red-600">{r.errors.join("؛ ")}</span> <span className="text-amber-700">{r.warnings.join("؛ ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary" disabled={busy || !importable} onClick={() => send(false, mapping)}>استيراد {importable} طالبة</button>
        </>
      )}
    </div>
  );
}
