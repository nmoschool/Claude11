"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function PrintToolbar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const landscape = pathname.startsWith("/print/gradebook");

  async function pdf() {
    setBusy(true);
    setMsg(null);
    const qs = sp.toString();
    const path = pathname + (qs ? `?${qs}` : "");
    const name = document.title || "تقرير";
    const res = await fetch(`/api/v1/pdf?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}${landscape ? "&landscape=1" : ""}`);
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error?.message_ar ?? "تعذّر توليد PDF");
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-center gap-2 border-b bg-white/90 p-3 backdrop-blur">
      <button className="btn-primary" onClick={pdf} disabled={busy}>{busy ? "جارٍ التوليد..." : "⬇️ تنزيل PDF"}</button>
      <button className="btn-secondary" onClick={() => window.print()}>🖨️ طباعة</button>
      <button className="btn-secondary" onClick={() => history.back()}>رجوع</button>
      {msg && <span className="text-sm text-red-600">{msg}</span>}
    </div>
  );
}
