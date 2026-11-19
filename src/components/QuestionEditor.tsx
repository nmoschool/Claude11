"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import { QTYPE_LABELS, QTYPES, defaultModeForSkill, type QType } from "@/lib/questionTypes";

export interface BankQuestion {
  id: string;
  type: QType;
  stem: string;
  payload: any;
  answerKey: any;
  points: number;
  difficulty: number;
  status: "DRAFT" | "APPROVED";
  skillCode: string | null;
  lessonId: string | null;
  parentId: string | null;
}
interface Skill { code: string; title: string; domain: string }
interface Lesson { id: string; title: string }

const lines = (s: string) => s.split(/\n|،|,/).map((x) => x.trim()).filter(Boolean);

/** نموذج تحرير موحّد يُحوَّل إلى payload/answerKey عند الحفظ */
function toForm(q: Partial<BankQuestion> & { type: QType }) {
  const p = q.payload ?? {};
  const k = q.answerKey ?? {};
  return {
    options: p.options ?? ["", "", ""],
    correct: typeof k.correct === "number" ? k.correct : 0,
    tf: k.correct === false ? "false" : "true",
    accepted: (k.accepted ?? []).join("\n"),
    mode: k.mode ?? "lenient",
    pairs: p.left ? p.left.map((l: string, i: number) => ({ left: l, right: p.right[k.pairs[i]] })) : [{ left: "", right: "" }, { left: "", right: "" }],
    distractors: p.right && k.pairs ? p.right.filter((_: string, i: number) => !k.pairs.includes(i)).join("\n") : "",
    buckets: (p.buckets ?? ["", ""]).join("\n"),
    items: p.items ? p.items.map((t: string, i: number) => ({ text: t, bucket: k.bucketOf[i] })) : [{ text: "", bucket: 0 }, { text: "", bucket: 1 }],
    sentences: (k.sentences ?? []).map((s: string[]) => s.join(" ")).join("\n"),
    passage: p.passage ?? "",
    count: k.count ?? 2,
    source: p.source ?? "",
    say: p.say ?? "",
    linesN: p.lines ?? 4,
    sample: k.sample ?? "",
    rubric: k.rubric ?? "",
  };
}
type Form = ReturnType<typeof toForm>;

function build(type: QType, f: Form): { payload: any; answerKey: any } {
  switch (type) {
    case "MCQ":
      return { payload: { options: f.options.map((o: string) => o.trim()).filter(Boolean) }, answerKey: { correct: f.correct } };
    case "TRUE_FALSE":
      return { payload: {}, answerKey: { correct: f.tf === "true" } };
    case "FILL_BLANK":
      return { payload: {}, answerKey: { accepted: lines(f.accepted), mode: f.mode } };
    case "MATCHING": {
      const pairs = f.pairs.filter((x: any) => x.left.trim() && x.right.trim());
      const right = [...pairs.map((x: any) => x.right.trim()), ...lines(f.distractors)];
      return { payload: { left: pairs.map((x: any) => x.left.trim()), right }, answerKey: { pairs: pairs.map((_: any, i: number) => i) } };
    }
    case "CLASSIFY": {
      const items = f.items.filter((x: any) => x.text.trim());
      return { payload: { buckets: lines(f.buckets), items: items.map((x: any) => x.text.trim()) }, answerKey: { bucketOf: items.map((x: any) => Number(x.bucket)) } };
    }
    case "ORDER_WORDS": {
      const sentences = f.sentences.split("\n").map((s: string) => s.trim().split(/\s+/).filter(Boolean)).filter((s: string[]) => s.length);
      return { payload: { words: sentences[0] ?? [] }, answerKey: { sentences } };
    }
    case "EXTRACT":
      return { payload: { passage: f.passage }, answerKey: { accepted: lines(f.accepted), count: Number(f.count), mode: f.mode } };
    case "TRANSFORM":
      return { payload: { source: f.source }, answerKey: { accepted: lines(f.accepted), mode: f.mode } };
    case "DICTATION":
      return { payload: { say: f.say }, answerKey: { accepted: lines(f.accepted).length ? lines(f.accepted) : [f.say], mode: "spelling" } };
    case "OPEN":
      return { payload: { lines: Number(f.linesN) }, answerKey: { sample: f.sample || undefined, rubric: f.rubric || undefined } };
    case "READING_PASSAGE":
      return { payload: { passage: f.passage }, answerKey: {} };
  }
}

export default function QuestionEditor({ question, parentId, skills, lessons, onClose, onSaved }: {
  question: BankQuestion | null;
  parentId?: string | null;
  skills: Skill[];
  lessons: Lesson[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [type, setType] = useState<QType>(question?.type ?? "MCQ");
  const [stem, setStem] = useState(question?.stem ?? "");
  const [meta, setMeta] = useState({
    points: question?.points ?? 1,
    difficulty: question?.difficulty ?? 1,
    skillCode: question?.skillCode ?? "",
    lessonId: question?.lessonId ?? "",
    status: question?.status ?? "APPROVED",
  });
  const [f, setF] = useState<Form>(() => toForm(question ?? { type: "MCQ" }));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Form>) => setF({ ...f, ...p });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const body = {
      type,
      stem,
      ...build(type, f),
      points: Number(meta.points),
      difficulty: Number(meta.difficulty),
      skillCode: meta.skillCode || null,
      lessonId: meta.lessonId || null,
      parentId: question?.parentId ?? parentId ?? null,
      status: meta.status,
    };
    try {
      if (question) await api(`/api/v1/questions/${question.id}`, "PATCH", body);
      else await api("/api/v1/questions", "POST", body);
      onSaved(question ? "تم حفظ السؤال" : "تمت إضافة السؤال");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const modeSelect = (
    <label className="flex items-center gap-2 text-sm">
      المطابقة:
      <select className="input w-auto" value={f.mode} onChange={(e) => set({ mode: e.target.value })}>
        <option value="lenient">متساهلة (تتجاهل الهمزات والتاء) — للنحو والفهم</option>
        <option value="spelling">إملائية صارمة — للرسم الإملائي</option>
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-start bg-black/30" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-2xl space-y-4 overflow-y-auto bg-white p-5 shadow-xl" role="dialog" aria-label="محرر السؤال">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">{question ? "تعديل سؤال" : parentId ? "سؤال جديد للنص القرائي" : "سؤال جديد"}</h2>
          <button type="button" className="btn-secondary" onClick={onClose}>إغلاق</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">نوع السؤال</label>
            <select className="input" disabled={!!question} value={type} onChange={(e) => { const t = e.target.value as QType; setType(t); setF(toForm({ type: t })); }}>
              {QTYPES.filter((t) => !(parentId && t === "READING_PASSAGE")).map((t) => <option key={t} value={t}>{QTYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">المهارة</label>
            <select className="input" value={meta.skillCode} onChange={(e) => { setMeta({ ...meta, skillCode: e.target.value }); if (!question) set({ mode: defaultModeForSkill(e.target.value) }); }}>
              <option value="">—</option>
              {skills.map((s) => <option key={s.code} value={s.code}>{s.title} ({s.domain})</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">{type === "READING_PASSAGE" ? "عنوان/تعليمات النص" : "نص السؤال"}</label>
          <textarea className="input min-h-[60px]" required minLength={2} value={stem} onChange={(e) => setStem(e.target.value)}
            placeholder={type === "FILL_BLANK" ? "مثال: ذهبت ____ إلى المدرسة." : ""} />
          {type === "FILL_BLANK" && <p className="mt-1 text-xs text-gray-500">ضعي مكان الفراغ أربع شرطات سفلية ____</p>}
        </div>

        <fieldset className="space-y-3 rounded-lg border border-gray-200 p-3">
          <legend className="px-1 text-sm font-bold">الإجابة</legend>
          {type === "MCQ" && (
            <>
              {f.options.map((o: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={f.correct === i} onChange={() => set({ correct: i })} aria-label={`الخيار ${i + 1} صحيح`} />
                  <input className="input" value={o} placeholder={`الخيار ${i + 1}`} onChange={(e) => set({ options: f.options.map((x: string, j: number) => (j === i ? e.target.value : x)) })} />
                  {f.options.length > 2 && <button type="button" className="text-xs text-red-600" onClick={() => set({ options: f.options.filter((_: string, j: number) => j !== i), correct: f.correct >= i && f.correct > 0 ? f.correct - 1 : f.correct })}>✕</button>}
                </div>
              ))}
              {f.options.length < 6 && <button type="button" className="btn-secondary" onClick={() => set({ options: [...f.options, ""] })}>＋ خيار</button>}
              <p className="text-xs text-gray-500">اختاري الدائرة بجانب الإجابة الصحيحة. تُخلط الخيارات تلقائياً في كل نموذج.</p>
            </>
          )}
          {type === "TRUE_FALSE" && (
            <div className="flex gap-4">
              <label className="flex items-center gap-1"><input type="radio" checked={f.tf === "true"} onChange={() => set({ tf: "true" })} /> صواب</label>
              <label className="flex items-center gap-1"><input type="radio" checked={f.tf === "false"} onChange={() => set({ tf: "false" })} /> خطأ</label>
            </div>
          )}
          {(type === "FILL_BLANK" || type === "TRANSFORM" || type === "EXTRACT") && (
            <>
              {type === "TRANSFORM" && <div><label className="label">الكلمة/الجملة المطلوب تحويلها</label><input className="input" required value={f.source} onChange={(e) => set({ source: e.target.value })} /></div>}
              {type === "EXTRACT" && (
                <>
                  <div><label className="label">النص</label><textarea className="input min-h-[80px]" required value={f.passage} onChange={(e) => set({ passage: e.target.value })} /></div>
                  <div><label className="label">عدد الكلمات المطلوب استخراجها</label><input className="input w-24" type="number" min={1} max={10} value={f.count} onChange={(e) => set({ count: Number(e.target.value) })} /></div>
                </>
              )}
              <div><label className="label">الإجابات المقبولة (كل إجابة في سطر)</label><textarea className="input min-h-[70px]" required value={f.accepted} onChange={(e) => set({ accepted: e.target.value })} /></div>
              {modeSelect}
            </>
          )}
          {type === "MATCHING" && (
            <>
              {f.pairs.map((pr: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input" placeholder="العنصر" value={pr.left} onChange={(e) => set({ pairs: f.pairs.map((x: any, j: number) => (j === i ? { ...x, left: e.target.value } : x)) })} />
                  <span>←</span>
                  <input className="input" placeholder="ما يطابقه" value={pr.right} onChange={(e) => set({ pairs: f.pairs.map((x: any, j: number) => (j === i ? { ...x, right: e.target.value } : x)) })} />
                  {f.pairs.length > 2 && <button type="button" className="text-xs text-red-600" onClick={() => set({ pairs: f.pairs.filter((_: any, j: number) => j !== i) })}>✕</button>}
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={() => set({ pairs: [...f.pairs, { left: "", right: "" }] })}>＋ زوج</button>
              <div><label className="label">مشتّتات إضافية في العمود الثاني (اختياري، سطر لكل منها)</label><textarea className="input" value={f.distractors} onChange={(e) => set({ distractors: e.target.value })} /></div>
            </>
          )}
          {type === "CLASSIFY" && (
            <>
              <div><label className="label">المجموعات (سطر لكل مجموعة)</label><textarea className="input" value={f.buckets} onChange={(e) => set({ buckets: e.target.value })} /></div>
              {f.items.map((it: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input" placeholder="العنصر" value={it.text} onChange={(e) => set({ items: f.items.map((x: any, j: number) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                  <select className="input w-40" value={it.bucket} onChange={(e) => set({ items: f.items.map((x: any, j: number) => (j === i ? { ...x, bucket: Number(e.target.value) } : x)) })} aria-label="المجموعة">
                    {lines(f.buckets).map((b, bi) => <option key={bi} value={bi}>{b}</option>)}
                  </select>
                  <button type="button" className="text-xs text-red-600" onClick={() => set({ items: f.items.filter((_: any, j: number) => j !== i) })}>✕</button>
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={() => set({ items: [...f.items, { text: "", bucket: 0 }] })}>＋ عنصر</button>
            </>
          )}
          {type === "ORDER_WORDS" && (
            <div>
              <label className="label">الجملة الصحيحة (الكلمات بمسافات)، وفي الأسطر التالية ترتيبات صحيحة أخرى إن وُجدت</label>
              <textarea className="input min-h-[70px]" required value={f.sentences} onChange={(e) => set({ sentences: e.target.value })} placeholder={"ذهبَ محمدٌ إلى المدرسةِ\nمحمدٌ ذهبَ إلى المدرسةِ"} />
              <p className="text-xs text-gray-500">تُعرض الكلمات للطالبة مخلوطة.</p>
            </div>
          )}
          {type === "DICTATION" && (
            <>
              <div><label className="label">الكلمة التي تُنطق للطالبة</label><input className="input" required value={f.say} onChange={(e) => set({ say: e.target.value })} /></div>
              <div><label className="label">كتابات مقبولة إضافية (اختياري)</label><textarea className="input" value={f.accepted} onChange={(e) => set({ accepted: e.target.value })} /></div>
              <p className="text-xs text-gray-500">تُنطق الكلمة بصوت المتصفح، وتُصحَّح بمطابقة إملائية صارمة. في الورقة المطبوعة تُمليها المعلمة.</p>
            </>
          )}
          {type === "OPEN" && (
            <>
              <div><label className="label">عدد الأسطر في الورقة</label><input className="input w-24" type="number" min={1} max={15} value={f.linesN} onChange={(e) => set({ linesN: Number(e.target.value) })} /></div>
              <div><label className="label">إجابة نموذجية</label><textarea className="input" value={f.sample} onChange={(e) => set({ sample: e.target.value })} /></div>
              <div><label className="label">معيار التصحيح</label><textarea className="input" value={f.rubric} onChange={(e) => set({ rubric: e.target.value })} /></div>
            </>
          )}
          {type === "READING_PASSAGE" && (
            <div><label className="label">النص القرائي</label><textarea className="input min-h-[160px]" required minLength={20} value={f.passage} onChange={(e) => set({ passage: e.target.value })} /><p className="text-xs text-gray-500">بعد الحفظ أضيفي أسئلة النص من زر «＋ سؤال للنص».</p></div>
          )}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-4">
          {type !== "READING_PASSAGE" && <div><label className="label">الدرجة</label><input className="input" type="number" min={0.25} step={0.25} max={50} value={meta.points} onChange={(e) => setMeta({ ...meta, points: Number(e.target.value) })} /></div>}
          <div><label className="label">الصعوبة</label><select className="input" value={meta.difficulty} onChange={(e) => setMeta({ ...meta, difficulty: Number(e.target.value) })}><option value={1}>سهل</option><option value={2}>متوسط</option><option value={3}>صعب</option></select></div>
          <div className="sm:col-span-2"><label className="label">الدرس</label><select className="input" value={meta.lessonId} onChange={(e) => setMeta({ ...meta, lessonId: e.target.value })}><option value="">—</option>{lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={meta.status === "APPROVED"} onChange={(e) => setMeta({ ...meta, status: e.target.checked ? "APPROVED" : "DRAFT" })} /> معتمد للاستخدام في الاختبارات</label>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{err}</div>}
        <button className="btn-primary" disabled={busy}>{busy ? "..." : "حفظ"}</button>
      </form>
    </div>
  );
}
