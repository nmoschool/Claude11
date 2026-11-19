"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

const ERRORS: Record<string, string> = {
  INVALID: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  LOCKED: "تم قفل الحساب مؤقتاً (15 دقيقة) بسبب محاولات خاطئة متكررة",
  OTP_INVALID: "رمز التحقق غير صحيح",
  RATE_LIMITED: "محاولات كثيرة، انتظري دقيقة ثم أعيدي المحاولة",
};

export default function StaffLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needOtp, setNeedOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("staff", { email, password, otp, redirect: false });
    setLoading(false);
    if (res?.error) {
      if (res.error === "OTP_REQUIRED") {
        setNeedOtp(true);
        return;
      }
      setError(ERRORS[res.error] ?? ERRORS.INVALID);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-3 text-2xl font-black">منصة لغتي</h1>
          <p className="mt-1 text-sm text-gray-500">الصف الرابع الابتدائي — دخول المعلمات والمشرفات</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          {!needOtp ? (
            <>
              <div>
                <label className="label" htmlFor="email">البريد الإلكتروني</label>
                <input id="email" type="email" required dir="ltr" className="input" value={email}
                  onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </div>
              <div>
                <label className="label" htmlFor="password">كلمة المرور</label>
                <input id="password" type="password" required dir="ltr" className="input" value={password}
                  onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
            </>
          ) : (
            <div>
              <label className="label" htmlFor="otp">رمز التحقق من تطبيق المصادقة</label>
              <input id="otp" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoFocus dir="ltr"
                className="input text-center text-2xl tracking-[0.5em]" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" />
              <p className="mt-2 text-xs text-gray-500">افتحي تطبيق المصادقة (Google / Microsoft Authenticator) وأدخلي الرمز المكوّن من 6 أرقام.</p>
            </div>
          )}

          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? "جارٍ التحقق..." : needOtp ? "تأكيد" : "تسجيل الدخول"}
          </button>
          {needOtp && (
            <button type="button" className="btn-secondary w-full" onClick={() => { setNeedOtp(false); setOtp(""); }}>
              رجوع
            </button>
          )}
        </form>

        <Link href="/student-login" className="mt-6 block rounded-xl2 border-2 border-dashed border-accent-200 bg-accent-50 p-4 text-center font-bold text-accent-700 hover:bg-accent-100">
          🌸 دخول الطالبات
        </Link>
      </div>
    </div>
  );
}
