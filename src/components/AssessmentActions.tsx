"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function AssessmentActions({ assessmentId, classes, canPublish, canDelete }: { assessmentId: string; classes: { id: string; label: string }[]; canPublish: boolean; canDelete: boolean }) {
  const router = useRouter();
  const now = new Date();
  const [f, setF] = useState({ classId: classes[0]?.id ?? "", mode: "ONLINE", opensAt: local(now), closesAt: local(new Date(now.getTime() + 7 * 86400000)), toGradebook: true });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/v1/assessments/${assessmentId}/publish`, "POST", {
        classId: f.classId,
        mode: f.mode,
        opensAt: new Date(f.opensAt).toISOString(),
        closesAt: f.closesAt ? new Date(f.closesAt).toISOString() : null,
        toGradebook: f.toGradebook,
      });
      setMsg({ ok: true, text: f.mode === "ONLINE" ? "تم النشر — يظهر للطالبات في «واجباتي» عند موعد الفتح" : "تم النشر الورقي — اطبعي الأوراق بأسماء الطالبات" });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <div className="space-y-3">
      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</div>}
      {canPublish && classes.length > 0 && (
        <form onSubmit={publish} className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
          <div><label className="label">الفصل</label><select className="input w-auto" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>{classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          <div><label className="label">الطريقة</label><select className="input w-auto" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="ONLINE">💻 حل إلكتروني</option><option value="PAPER">📄 ورقي</option></select></div>
          <div><label className="label">يفتح</label><input className="input w-auto" type="datetime-local" required value={f.opensAt} onChange={(e) => setF({ ...f, opensAt: e.target.value })} /></div>
          <div><label className="label">يغلق</label><input className="input w-auto" type="datetime-local" value={f.closesAt} onChange={(e) => setF({ ...f, closesAt: e.target.value })} /></div>
          <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" checked={f.toGradebook} onChange={(e) => setF({ ...f, toGradebook: e.target.checked })} /> نقل النتائج لسجل الدرجات</label>
          <button className="btn-primary">نشر</button>
        </form>
      )}
      {canDelete && (
        <button className="text-sm text-red-600" onClick={() => confirm("حذف الاختبار؟") && api(`/api/v1/assessments/${assessmentId}`, "DELETE").then(() => router.push("/dashboard/assessments"), (e) => setMsg({ ok: false, text: e.message }))}>حذف الاختبار</button>
      )}
    </div>
  );
}
