"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SecuritySettings({ totpEnabled, forced }: { totpEnabled: boolean; forced: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(totpEnabled);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });

  async function start() {
    const res = await fetch("/api/v1/account/2fa/setup", { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: data.error?.message_ar });
    setQr(data);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/v1/account/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: data.error?.message_ar });
    setEnabled(true);
    setQr(null);
    await update(); // تحديث الجلسة لرفع قيد «يجب تفعيل 2FA»
    setMsg({ ok: true, text: "تم تفعيل التحقق الثنائي بنجاح ✅" });
    // تنقّل كامل (وليس router.push) حتى لا يُستخدم توجيه مخزّن مسبقاً من مرحلة ما قبل التفعيل
    if (forced) window.location.assign("/dashboard");
    else router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/v1/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pw),
    });
    const data = await res.json();
    if (!res.ok) {
      const issue = data.error?.issues?.[0]?.message;
      return setMsg({ ok: false, text: issue ?? data.error?.message_ar });
    }
    setPw({ current: "", next: "" });
    setMsg({ ok: true, text: "تم تغيير كلمة المرور" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-black">حسابي والأمان</h1>
      {forced && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          🔐 لحماية بيانات الطالبات، يجب تفعيل <b>التحقق الثنائي</b> قبل استخدام المنصة.
        </div>
      )}
      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</div>}

      <section className="card p-5">
        <h2 className="mb-2 font-black">التحقق الثنائي (2FA)</h2>
        {enabled ? (
          <p className="text-sm text-mint-700">✅ مفعّل. عند فقدان الجوال تواصلي مع قائدة المدرسة لإعادة ضبطه.</p>
        ) : !qr ? (
          <>
            <p className="mb-3 text-sm text-gray-600">ثبّتي تطبيق <b>Google Authenticator</b> أو <b>Microsoft Authenticator</b> على جوالك ثم اضغطي «بدء الإعداد».</p>
            <button className="btn-primary" onClick={start}>بدء الإعداد</button>
          </>
        ) : (
          <form onSubmit={confirm} className="space-y-3">
            <p className="text-sm text-gray-600">1) امسحي الرمز بتطبيق المصادقة:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qr} alt="رمز QR لتطبيق المصادقة" className="h-52 w-52 rounded border" />
            <p className="text-xs text-gray-500">أو أدخلي المفتاح يدوياً: <code dir="ltr" className="select-all rounded bg-gray-100 px-1">{qr.secret}</code></p>
            <p className="text-sm text-gray-600">2) أدخلي الرمز الظاهر في التطبيق:</p>
            <input className="input w-48 text-center text-xl tracking-[0.4em]" dir="ltr" inputMode="numeric" maxLength={6} required
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="رمز التحقق" />
            <div><button className="btn-primary">تأكيد التفعيل</button></div>
          </form>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-black">تغيير كلمة المرور</h2>
        <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-2">
          <input className="input" type="password" dir="ltr" placeholder="الحالية" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
          <input className="input" type="password" dir="ltr" placeholder="الجديدة (10 أحرف، حرف ورقم)" required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
          <div><button className="btn-secondary">تغيير</button></div>
        </form>
      </section>
    </div>
  );
}
