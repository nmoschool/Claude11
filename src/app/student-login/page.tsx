"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PICTURES, CODE_LENGTH } from "@/lib/pictures";

interface RosterStudent {
  id: string;
  displayName: string;
  avatar: string;
}

const ERRORS: Record<string, string> = {
  INVALID: "الصور غير صحيحة، حاولي مرة أخرى 💜",
  LOCKED: "توقفي قليلاً ⏳ واطلبي المساعدة من معلمتك",
  RATE_LIMITED: "انتظري دقيقة ثم حاولي مرة أخرى",
};

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-SA";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* المتصفح لا يدعم القراءة الصوتية */
  }
}

export default function StudentLogin() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [classCode, setClassCode] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [student, setStudent] = useState<RosterStudent | null>(null);
  const [code, setCode] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadClass(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/v1/auth/class-roster?code=${encodeURIComponent(classCode.trim().toUpperCase())}`);
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message_ar ?? "رمز الفصل غير صحيح");
      return;
    }
    setClassLabel(data.label);
    setRoster(data.students);
    setStep(2);
    speak("اختاري اسمك");
  }

  async function pick(idx: number) {
    if (loading || code.length >= CODE_LENGTH) return;
    const next = [...code, idx];
    setCode(next);
    setError(null);
    if (next.length === CODE_LENGTH && student) {
      setLoading(true);
      const res = await signIn("student", {
        classCode: classCode.trim().toUpperCase(),
        studentId: student.id,
        code: next.join("-"),
        redirect: false,
      });
      setLoading(false);
      if (res?.error) {
        setError(ERRORS[res.error] ?? ERRORS.INVALID);
        setCode([]);
        speak(res.error === "LOCKED" ? "اطلبي المساعدة من معلمتك" : "حاولي مرة أخرى");
        return;
      }
      speak(`أهلاً ${student.displayName}`);
      router.push("/student");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent-50 via-brand-50 to-mint-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-center text-3xl font-black text-brand-800">🌸 أهلاً بكِ في لغتي</h1>
        <p className="mb-8 text-center text-lg text-gray-600">
          {step === 1 && "اكتبي رمز الفصل المكتوب على بطاقتك"}
          {step === 2 && `${classLabel} — اختاري اسمك`}
          {step === 3 && "اضغطي صورك السرية بالترتيب"}
        </p>

        {step === 1 && (
          <form onSubmit={loadClass} className="card mx-auto max-w-md space-y-5 p-8">
            <input
              aria-label="رمز الفصل"
              dir="ltr"
              maxLength={6}
              autoFocus
              required
              className="input py-4 text-center text-3xl font-black uppercase tracking-[0.4em]"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
              placeholder="ABC234"
            />
            {error && <p className="text-center text-lg text-red-600">{error}</p>}
            <button className="btn-primary w-full py-4 text-xl" disabled={loading || classCode.length !== 6}>
              {loading ? "..." : "التالي ←"}
            </button>
          </form>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {roster.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStudent(s);
                    setCode([]);
                    setError(null);
                    setStep(3);
                    speak("اضغطي صورك السرية");
                  }}
                  className="card flex min-h-[120px] flex-col items-center justify-center gap-2 p-4 text-xl font-bold transition hover:scale-105 hover:border-brand-400"
                >
                  <span className="text-5xl">{s.avatar}</span>
                  {s.displayName}
                </button>
              ))}
            </div>
            {!roster.length && <p className="text-center text-gray-500">لا توجد طالبات مفعّلات في هذا الفصل بعد.</p>}
            <button className="btn-secondary mx-auto mt-6 flex" onClick={() => setStep(1)}>→ رجوع</button>
          </>
        )}

        {step === 3 && student && (
          <div className="card mx-auto max-w-lg p-6">
            <div className="mb-4 flex items-center justify-center gap-3 text-2xl font-black">
              <span className="text-4xl">{student.avatar}</span> {student.displayName}
            </div>
            <div className="mb-6 flex justify-center gap-3" aria-live="polite" aria-label={`اخترتِ ${code.length} من ${CODE_LENGTH}`}>
              {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                <div key={i} className={`flex h-14 w-14 items-center justify-center rounded-full border-4 text-2xl ${i < code.length ? "border-brand-500 bg-brand-100" : "border-gray-200"}`}>
                  {i < code.length ? "●" : ""}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {PICTURES.map((p) => (
                <button
                  key={p.id}
                  aria-label={p.label}
                  onClick={() => pick(p.id)}
                  disabled={loading}
                  className="flex aspect-square items-center justify-center rounded-2xl border-2 border-gray-100 bg-white text-5xl shadow-sm transition active:scale-95 hover:border-accent-300 sm:text-6xl"
                >
                  {p.emoji}
                </button>
              ))}
            </div>
            {error && <p className="mt-4 text-center text-lg text-red-600" role="alert">{error}</p>}
            <div className="mt-6 flex justify-between">
              <button className="btn-secondary" onClick={() => { setStep(2); setCode([]); }}>→ لستُ {student.displayName}</button>
              <button className="btn-secondary" onClick={() => setCode([])} disabled={!code.length}>مسح ✕</button>
            </div>
          </div>
        )}

        <Link href="/login" className="mt-10 block text-center text-sm text-gray-400 hover:text-gray-600">دخول المعلمات</Link>
      </div>
    </div>
  );
}
