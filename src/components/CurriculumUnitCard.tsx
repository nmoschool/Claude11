"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Lesson {
  id: string;
  order: number;
  title: string;
}

interface Props {
  id: string;
  order: number;
  title: string;
  description: string | null;
  weeksPlan: string | null;
  lessons: Lesson[];
  editable: boolean;
}

export default function CurriculumUnitCard({
  id,
  order,
  title,
  description,
  weeksPlan,
  lessons,
  editable,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title,
    description: description ?? "",
    weeksPlan: weeksPlan ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/curriculum/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="badge bg-brand-100 text-brand-700">الوحدة {order}</span>
          {!editing && weeksPlan && (
            <span className="badge bg-gray-100 text-gray-600">{weeksPlan}</span>
          )}
        </div>
        {editable && (
          <button
            className="text-xs font-bold text-brand-700 hover:underline"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "إلغاء" : "✎ تعديل"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            className="input font-bold"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            className="input"
            placeholder="التقسيم الزمني (مثال: الأسابيع 1-3)"
            value={form.weeksPlan}
            onChange={(e) => setForm({ ...form, weeksPlan: e.target.value })}
          />
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "جارِ الحفظ..." : "حفظ"}
          </button>
        </div>
      ) : (
        <>
          <h3 className="mb-1 font-black text-gray-900">{title}</h3>
          {description && <p className="mb-3 text-sm text-gray-500">{description}</p>}
        </>
      )}

      {!editing && lessons.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3">
          {lessons.map((l) => (
            <li key={l.id} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              {l.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
