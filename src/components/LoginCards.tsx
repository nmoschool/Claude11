"use client";

import { useState } from "react";
import { PICTURES } from "@/lib/pictures";

interface Card {
  id: string;
  fullName: string;
  displayName: string;
  avatar: string;
  code: number[];
}

/** توليد رموز الصور وطباعة بطاقات الدخول (A4: 8 بطاقات في الصفحة) */
export default function LoginCards({ classId, students }: { classId: string; students: { id: string; fullName: string }[] }) {
  const [selected, setSelected] = useState<string>("ALL");
  const [result, setResult] = useState<{ classLabel: string; joinCode: string; cards: Card[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    const who = selected === "ALL" ? "جميع طالبات الفصل" : students.find((s) => s.id === selected)?.fullName;
    if (!confirm(`سيتم إلغاء الرموز الحالية وإنشاء رموز جديدة لـ: ${who}. متابعة؟`)) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/v1/classes/${classId}/picture-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected === "ALL" ? {} : { studentIds: [selected] }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) return setError(data.error?.message_ar ?? "تعذّر التوليد");
    setResult(data);
  }

  return (
    <div className="card p-5">
      <div className="no-print">
        <h2 className="mb-1 font-black">🔑 بطاقات دخول الطالبات</h2>
        <p className="mb-4 text-sm text-gray-500">
          الرموز تظهر <b>مرة واحدة فقط</b> عند التوليد (المخزَّن نسخة مشفّرة غير قابلة للاسترجاع). اطبعي البطاقات مباشرة.
        </p>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="ALL">جميع طالبات الفصل</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </select>
          <button className="btn-primary" onClick={generate} disabled={loading}>{loading ? "..." : "توليد رموز جديدة"}</button>
          {result && <button className="btn-accent" onClick={() => window.print()}>🖨️ طباعة البطاقات</button>}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="mt-5 grid grid-cols-2 gap-4 print:mt-0 print:gap-3">
          {result.cards.map((c) => (
            <div key={c.id} className="break-inside-avoid rounded-xl2 border-2 border-dashed border-brand-300 p-4 text-center">
              <div className="text-xs text-gray-500">منصة لغتي — {result.classLabel}</div>
              <div className="my-1 text-lg font-black"><span className="ml-1 text-2xl">{c.avatar}</span>{c.fullName}</div>
              <div className="text-xs text-gray-500">رمز الفصل</div>
              <div dir="ltr" className="font-mono text-2xl font-black tracking-[0.3em] text-brand-700">{result.joinCode}</div>
              <div className="mt-2 text-xs text-gray-500">صوري السرية بالترتيب ←</div>
              <div className="mt-1 flex justify-center gap-2">
                {c.code.map((p, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg border bg-white text-3xl">{PICTURES[p].emoji}</span>
                    <span className="text-[10px] text-gray-500">{i + 1}. {PICTURES[p].label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
