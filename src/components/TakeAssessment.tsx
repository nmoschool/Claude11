"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DisplayQuestion } from "@/lib/renderVersion";

type Answers = Record<string, any>;
const LETTERS = "أبجدهو";

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-SA";
    u.rate = 0.8;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* غير مدعوم */
  }
}

export default function TakeAssessment({ publicationId }: { publicationId: string }) {
  const [data, setData] = useState<any>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [result, setResult] = useState<{ score: number; max: number; pendingManual: number } | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const dirty = useRef<Answers>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const skew = useRef(0);

  useEffect(() => {
    fetch(`/api/v1/me/assessments/${publicationId}/start`, { method: "POST" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error?.message_ar ?? "تعذّر فتح الاختبار");
        skew.current = new Date(d.serverNow).getTime() - Date.now();
        setData(d);
        setAnswers(d.answers ?? {});
      })
      .catch((e) => setError(e.message));
  }, [publicationId]);

  const flush = useCallback(async () => {
    if (!data || !Object.keys(dirty.current).length) return;
    const batch = dirty.current;
    dirty.current = {};
    setSaved("saving");
    const r = await fetch(`/api/v1/me/attempts/${data.attemptId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: batch }) }).catch(() => null);
    if (!r?.ok) {
      dirty.current = { ...batch, ...dirty.current };
      setSaved("error");
    } else setSaved("saved");
  }, [data]);

  const submit = useCallback(async (auto = false) => {
    if (!data) return;
    if (!auto && !confirm("هل أنتِ متأكدة من تسليم الإجابات؟")) return;
    clearTimeout(timer.current);
    await flush();
    const r = await fetch(`/api/v1/me/attempts/${data.attemptId}/submit`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) return setError(d.error?.message_ar ?? "تعذّر التسليم");
    setResult(d);
    speak("أحسنتِ! تم تسليم إجاباتك");
  }, [data, flush]);

  // المؤقت والتسليم الآلي عند انتهاء الوقت
  useEffect(() => {
    if (!data?.deadline || result) return;
    const end = new Date(data.deadline).getTime();
    const tick = () => {
      const s = Math.max(0, Math.round((end - (Date.now() + skew.current)) / 1000));
      setLeft(s);
      if (s === 0) submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data, result, submit]);

  const set = (qid: string, v: any) => {
    setAnswers((a) => ({ ...a, [qid]: v }));
    dirty.current[qid] = v;
    setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1200);
  };

  if (error) return <Shell><div className="rounded-3xl bg-white p-10 text-center text-2xl shadow">{error}<div className="mt-6"><Link className="rounded-2xl bg-brand-600 px-6 py-3 text-white" href="/student/assessments">رجوع</Link></div></div></Shell>;
  if (!data) return <Shell><p className="text-center text-2xl">⏳</p></Shell>;
  if (result) {
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-10 text-center shadow">
          <div className="text-7xl">🎉</div>
          <h1 className="mt-4 text-3xl font-black text-brand-800">أحسنتِ! سلّمتِ إجاباتك</h1>
          <p className="mt-4 text-2xl">درجتك: <b className="text-mint-700">{result.score}</b> من {result.max}</p>
          {result.pendingManual > 0 && <p className="mt-2 text-lg text-amber-700">ستصحّح معلمتك {result.pendingManual} {result.pendingManual === 1 ? "سؤالاً" : "أسئلة"} بنفسها ✍️</p>}
          <Link className="mt-8 inline-block rounded-2xl bg-brand-600 px-8 py-4 text-xl font-black text-white" href="/student/assessments">رجوع إلى واجباتي</Link>
        </div>
      </Shell>
    );
  }

  const qs: DisplayQuestion[] = data.questions;
  const answerable = qs.filter((q) => q.number);
  const answered = answerable.filter((q) => isAnswered(answers[q.id])).length;

  return (
    <Shell>
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 bg-white/90 px-4 py-3 shadow backdrop-blur">
        <div className="font-black text-brand-800">{data.title}</div>
        <div className="flex items-center gap-3 text-sm">
          <span>{answered} / {answerable.length} ✏️</span>
          <span className={saved === "error" ? "text-red-600" : "text-gray-400"}>{saved === "saving" ? "يحفظ..." : saved === "error" ? "⚠️ لم يُحفظ — تحققي من الاتصال" : "✓ محفوظ"}</span>
          {left !== null && <span className={`rounded-full px-3 py-1 font-black ${left < 120 ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-700"}`}>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
        </div>
      </div>
      {data.instructions && <p className="mb-4 rounded-2xl bg-white/70 p-3 text-lg">📌 {data.instructions}</p>}
      <div className="space-y-4">
        {qs.map((q) => <Question key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />)}
      </div>
      <button className="mt-8 w-full rounded-3xl bg-mint-600 py-5 text-2xl font-black text-white shadow-lg hover:bg-mint-700" onClick={() => submit(false)}>
        تسليم الإجابات ✔️ {answered < answerable.length && <span className="text-base font-normal">(بقي {answerable.length - answered})</span>}
      </button>
    </Shell>
  );
}

function isAnswered(v: any) {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.some((x) => x !== null && x !== undefined && x !== "");
  return true;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gradient-to-b from-accent-50 via-brand-50 to-mint-50 px-4 pb-16"><div className="mx-auto max-w-3xl pt-2">{children}</div></div>;
}

const choice = (on: boolean) => `rounded-2xl border-2 px-4 py-3 text-lg font-bold transition active:scale-95 ${on ? "border-brand-600 bg-brand-100 text-brand-800" : "border-gray-200 bg-white hover:border-brand-300"}`;

function Question({ q, value, onChange }: { q: DisplayQuestion; value: any; onChange: (v: any) => void }) {
  if (q.type === "READING_PASSAGE") {
    return (
      <div className="rounded-3xl border-2 border-amber-200 bg-amber-50 p-5">
        <div className="mb-2 flex items-center justify-between"><b className="text-lg">{q.stem}</b><button className="text-2xl" aria-label="استمعي للنص" onClick={() => speak(q.passage!)}>🔊</button></div>
        <p className="whitespace-pre-wrap text-xl leading-loose">{q.passage}</p>
      </div>
    );
  }
  return (
    <div className={`rounded-3xl bg-white p-5 shadow ${q.parentId ? "mr-4 border-r-4 border-amber-200" : ""}`}>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-black text-white">{q.number}</span>
        <div className="flex-1 text-xl font-bold leading-relaxed">{q.stem}</div>
        <button className="text-2xl" aria-label="اقرئي السؤال" onClick={() => speak(q.stem.replace(/_{3,}/g, " فراغ "))}>🔊</button>
      </div>
      <Body q={q} value={value} onChange={onChange} />
    </div>
  );
}

function Body({ q, value, onChange }: { q: DisplayQuestion; value: any; onChange: (v: any) => void }) {
  switch (q.type) {
    case "MCQ":
      return <div className="grid gap-2 sm:grid-cols-2">{q.options!.map((o, i) => <button key={o.index} className={choice(value === o.index)} onClick={() => onChange(o.index)}><span className="ml-2 text-gray-400">{LETTERS[i]}</span>{o.text}</button>)}</div>;
    case "TRUE_FALSE":
      return <div className="flex gap-3"><button className={choice(value === true) + " flex-1"} onClick={() => onChange(true)}>✓ صواب</button><button className={choice(value === false) + " flex-1"} onClick={() => onChange(false)}>✗ خطأ</button></div>;
    case "FILL_BLANK":
    case "TRANSFORM":
    case "DICTATION":
      return (
        <div className="flex items-center gap-3">
          {q.type === "DICTATION" && <button className="rounded-2xl bg-brand-600 px-5 py-3 text-xl text-white" onClick={() => speak(q.say!)}>🔊 استمعي</button>}
          {q.type === "TRANSFORM" && <span className="text-xl font-bold">{q.source} ←</span>}
          <input className="input flex-1 py-3 text-2xl" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={`إجابة السؤال ${q.number}`} autoComplete="off" spellCheck={false} />
        </div>
      );
    case "MATCHING": {
      const v: (number | null)[] = value ?? q.left!.map(() => null);
      return (
        <div className="space-y-2">
          {q.left!.map((l, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="min-w-[7rem] rounded-xl bg-brand-50 px-3 py-2 text-lg font-bold">{l}</span>
              <span>←</span>
              <select className="input flex-1 py-2 text-lg" value={v[i] ?? ""} onChange={(e) => onChange(v.map((x, j) => (j === i ? (e.target.value === "" ? null : Number(e.target.value)) : x)))} aria-label={`مطابق ${l}`}>
                <option value="">اختاري…</option>
                {q.right!.map((r) => <option key={r.index} value={r.index}>{r.text}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    case "CLASSIFY": {
      const n = Math.max(...q.items!.map((it) => it.index)) + 1;
      const v: (number | null)[] = value ?? Array(n).fill(null);
      return (
        <div className="space-y-2">
          {q.items!.map((it) => (
            <div key={it.index} className="flex flex-wrap items-center gap-2">
              <span className="min-w-[7rem] text-xl font-bold">{it.text}</span>
              {q.buckets!.map((b, bi) => <button key={bi} className={choice(v[it.index] === bi) + " !py-2 text-base"} onClick={() => onChange(v.map((x, j) => (j === it.index ? bi : x)))}>{b}</button>)}
            </div>
          ))}
        </div>
      );
    }
    case "ORDER_WORDS": {
      const chosen: string[] = value ?? [];
      const remaining = [...q.words!];
      chosen.forEach((w) => { const i = remaining.indexOf(w); if (i >= 0) remaining.splice(i, 1); });
      return (
        <div className="space-y-3">
          <div className="flex min-h-[3.5rem] flex-wrap gap-2 rounded-2xl border-2 border-dashed border-brand-300 p-2">
            {chosen.map((w, i) => <button key={i} className="rounded-xl bg-brand-600 px-4 py-2 text-xl text-white" onClick={() => onChange(chosen.filter((_, j) => j !== i))}>{w}</button>)}
            {!chosen.length && <span className="self-center text-gray-400">اضغطي الكلمات بالترتيب</span>}
          </div>
          <div className="flex flex-wrap gap-2">{remaining.map((w, i) => <button key={i} className="rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-xl" onClick={() => onChange([...chosen, w])}>{w}</button>)}</div>
        </div>
      );
    }
    case "EXTRACT": {
      const sel: string[] = value ?? [];
      const words = q.passage!.split(/\s+/).map((w) => w.replace(/[.,،؛:!?؟"«»]/g, ""));
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">اضغطي {q.count} {q.count === 1 ? "كلمة" : "كلمات"} من النص ({sel.length}/{q.count})</p>
          <p className="rounded-2xl bg-gray-50 p-3 text-xl leading-[2.4]">
            {words.map((w, i) => {
              const on = sel.includes(w);
              return <button key={i} className={`mx-0.5 rounded-lg px-1 ${on ? "bg-brand-600 text-white" : "hover:bg-brand-100"}`} onClick={() => onChange(on ? sel.filter((x) => x !== w) : sel.length < (q.count ?? 1) ? [...sel, w] : sel)}>{w}</button>;
            })}
          </p>
        </div>
      );
    }
    case "OPEN":
      return <textarea className="input min-h-[140px] text-xl leading-loose" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={`إجابة السؤال ${q.number}`} />;
    default:
      return null;
  }
}
