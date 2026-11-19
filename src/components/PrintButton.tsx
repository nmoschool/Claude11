"use client";

export default function PrintButton({ label = "🖨️ طباعة / حفظ PDF" }: { label?: string }) {
  return <button onClick={() => window.print()} className="rounded-2xl bg-brand-600 px-5 py-2 font-bold text-white shadow">{label}</button>;
}
