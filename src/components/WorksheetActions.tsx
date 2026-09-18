"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ClassOption {
  id: string;
  name: string;
  grade: number;
}

export default function WorksheetActions({
  worksheetId,
  classes,
}: {
  worksheetId: string;
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [dueAt, setDueAt] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function assign() {
    if (!classId) return;
    setAssigning(true);
    setMessage(null);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worksheetId, classId, dueAt: dueAt || null }),
    });
    setAssigning(false);
    if (res.ok) {
      setMessage("تم تكليف الفصل بالورقة بنجاح ✅");
      router.refresh();
    } else {
      setMessage("تعذر إتمام التكليف");
    }
  }

  async function remove() {
    if (!confirm("هل أنت متأكد من حذف هذه الورقة؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    await fetch(`/api/worksheets/${worksheetId}`, { method: "DELETE" });
    router.push("/dashboard/worksheets");
  }

  return (
    <div className="no-print card space-y-4 p-5">
      <div className="flex flex-wrap gap-3">
        <button onClick={() => window.print()} className="btn-primary">
          🖨️ طباعة / تصدير PDF (A4)
        </button>
        <button onClick={remove} className="btn-danger">
          حذف الورقة
        </button>
      </div>

      {classes.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-2 text-sm font-bold text-gray-800">تكليف فصل بهذه الورقة</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">الفصل</label>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (الصف {c.grade === 1 ? "الأول" : "الثاني"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">تاريخ التسليم (اختياري)</label>
              <input
                type="date"
                className="input"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <button onClick={assign} disabled={assigning} className="btn-accent">
              {assigning ? "جارِ التكليف..." : "تكليف الفصل"}
            </button>
          </div>
          {message && <p className="mt-2 text-sm font-bold text-brand-700">{message}</p>}
        </div>
      )}
    </div>
  );
}
