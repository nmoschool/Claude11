"use client";

import { useEffect, useState } from "react";

interface Comment {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export default function SupervisorComments({ classId, canWrite }: { classId: string; canWrite: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/v1/classes/${classId}/comments`);
    if (res.ok) setComments((await res.json()).comments);
  }
  useEffect(() => {
    load();
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/v1/classes/${classId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) return setError((await res.json()).error?.message_ar ?? "تعذّر الحفظ");
    setBody("");
    load();
  }

  return (
    <div className="card no-print p-5">
      <h2 className="mb-3 font-black">📌 الملاحظات الإشرافية</h2>
      {canWrite && (
        <form onSubmit={submit} className="mb-4 space-y-2">
          <textarea className="input min-h-[80px]" value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="ملاحظة للمعلمة (لا تعدّل أي بيانات في الفصل)" required minLength={3} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary">إضافة ملاحظة</button>
        </form>
      )}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg bg-amber-50 p-3">
            <div className="whitespace-pre-wrap text-sm">{c.body}</div>
            <div className="mt-1 text-xs text-gray-500">{c.authorName} · {new Date(c.createdAt).toLocaleString("ar-SA")}</div>
          </li>
        ))}
        {!comments.length && <li className="text-sm text-gray-400">لا توجد ملاحظات بعد.</li>}
      </ul>
    </div>
  );
}
