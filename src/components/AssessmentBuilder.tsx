"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { QTYPE_LABELS, QTYPES } from "@/lib/questionTypes";
import QuestionCard from "@/components/QuestionCard";

interface Skill { code: string; title: string; domain: string }
interface Unit { id: string; termId: string; title: string; lessons: { id: string; title: string }[] }
interface Row { skillCode: string; type: string; difficulty: string; count: number }
type Q = { id: string; type: any; stem: string; payload: any; answerKey: any; points: number; parentId: string | null; skillTitle: string | null };

const TEMPLATES: Record<string, { label: string; kind: string; rows: Row[] }> = {
  spelling: { label: "اختبار قصير — الرسم الإملائي", kind: "QUIZ", rows: [{ skillCode: "SPELL.SHAMS_QAMAR", type: "", difficulty: "", count: 2 }, { skillCode: "SPELL.TAA", type: "", difficulty: "", count: 2 }, { skillCode: "SPELL.HAMZA_START", type: "", difficulty: "", count: 1 }] },
  grammar: { label: "اختبار قصير — الصنف والوظيفة النحوية", kind: "QUIZ", rows: [{ skillCode: "GRAM.NOMINAL", type: "", difficulty: "", count: 2 }, { skillCode: "GRAM.VERBAL", type: "", difficulty: "", count: 2 }, { skillCode: "LEX.NUMBER", type: "", difficulty: "", count: 2 }] },
  midterm: { label: "اختبار فتري شامل", kind: "MIDTERM", rows: [{ skillCode: "", type: "READING_PASSAGE", difficulty: "", count: 1 }, { skillCode: "SPELL.TAA", type: "", difficulty: "", count: 2 }, { skillCode: "LEX.VERB_TENSE", type: "", difficulty: "", count: 2 }, { skillCode: "GRAM.NOMINAL", type: "", difficulty: "", count: 2 }, { skillCode: "WRITE.EXPR", type: "", difficulty: "", count: 1 }] },
};

export default function AssessmentBuilder({ terms, defaultTerm, skills, units }: { terms: { id: string; title: string }[]; defaultTerm: string; skills: Skill[]; units: Unit[] }) {
  const router = useRouter();
  const [meta, setMeta] = useState({ kind: "QUIZ", title: "", termId: defaultTerm, durationMin: 20, versions: 2, instructions: "اقرئي كل سؤال جيدًا قبل الإجابة." });
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([{ skillCode: "", type: "", difficulty: "", count: 3 }]);
  const [picked, setPicked] = useState<Q[] | null>(null);
  const [shortages, setShortages] = useState<{ row: number; wanted: number; found: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const termUnits = units.filter((u) => u.termId === meta.termId);
  const total = useMemo(() => (picked ?? []).reduce((s, q) => s + (q.type === "READING_PASSAGE" ? 0 : q.points), 0), [picked]);

  async function generate() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await api("/api/v1/assessments/preview", "POST", {
        blueprint: rows.map((x) => ({ skillCode: x.skillCode || null, type: x.type || null, difficulty: x.difficulty ? Number(x.difficulty) : null, count: Number(x.count) })),
        lessonIds,
      });
      setShortages(r.shortages);
      // تفاصيل الأسئلة المختارة (مع المفاتيح) للمعاينة، بنفس ترتيب المولّد
      const got = r.questionIds.length ? await api(`/api/v1/questions?ids=${r.questionIds.join(",")}`) : { questions: [] };
      const map = new Map<string, Q>(got.questions.map((q: Q) => [q.id, q]));
      setPicked(r.questionIds.map((id: string) => map.get(id)).filter(Boolean) as Q[]);
      if (!r.questionIds.length) setMsg(`لا توجد أسئلة مطابقة في البنك (${r.poolSize} سؤال ضمن النطاق)`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    setPicked((p) => p!.filter((q) => q.id !== id && q.parentId !== id));
  }
  function move(i: number, d: number) {
    setPicked((p) => {
      const a = [...p!];
      const j = i + d;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api("/api/v1/assessments", "POST", {
        ...meta,
        durationMin: meta.durationMin || null,
        questionIds: picked!.map((q) => q.id),
        blueprint: { rows, lessonIds },
      });
      router.push(`/dashboard/assessments/${r.id}`);
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-black">اختبار / ورقة عمل جديدة</h1>
      <section className="card grid gap-3 p-5 md:grid-cols-3">
        <div><label className="label">النوع</label><select className="input" value={meta.kind} onChange={(e) => setMeta({ ...meta, kind: e.target.value })}><option value="WORKSHEET">ورقة عمل</option><option value="QUIZ">اختبار قصير</option><option value="MIDTERM">اختبار فتري</option><option value="FINAL">اختبار نهائي</option></select></div>
        <div className="md:col-span-2"><label className="label">العنوان</label><input className="input" required value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="مثال: اختبار قصير — الوحدة الثانية" /></div>
        <div><label className="label">الفصل الدراسي</label><select className="input" value={meta.termId} onChange={(e) => { setMeta({ ...meta, termId: e.target.value }); setLessonIds([]); }}>{terms.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
        <div><label className="label">الزمن (دقيقة، اختياري)</label><input className="input" type="number" min={5} max={240} value={meta.durationMin} onChange={(e) => setMeta({ ...meta, durationMin: Number(e.target.value) })} /></div>
        <div><label className="label">عدد النماذج</label><select className="input" value={meta.versions} onChange={(e) => setMeta({ ...meta, versions: Number(e.target.value) })}><option value={1}>نموذج واحد</option><option value={2}>نموذجان (أ، ب)</option><option value={3}>ثلاثة (أ، ب، ج)</option></select></div>
        <div className="md:col-span-3"><label className="label">تعليمات للطالبة</label><input className="input" value={meta.instructions} onChange={(e) => setMeta({ ...meta, instructions: e.target.value })} /></div>
      </section>

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black">جدول المواصفات</h2>
          <div className="flex gap-1 text-xs">قوالب: {Object.entries(TEMPLATES).map(([k, t]) => <button key={k} className="rounded bg-gray-100 px-2 py-1 hover:bg-gray-200" onClick={() => { setRows(t.rows); setMeta({ ...meta, kind: t.kind, title: meta.title || t.label }); }}>{t.label}</button>)}</div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-brand-700">نطاق الدروس ({lessonIds.length ? `${lessonIds.length} درس` : "كل الدروس"})</summary>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {termUnits.map((u) => (
              <div key={u.id} className="rounded border p-2 text-sm">
                <label className="font-bold"><input type="checkbox" className="ml-1" checked={u.lessons.every((l) => lessonIds.includes(l.id))} onChange={(e) => setLessonIds(e.target.checked ? Array.from(new Set([...lessonIds, ...u.lessons.map((l) => l.id)])) : lessonIds.filter((id) => !u.lessons.some((l) => l.id === id)))} />{u.title}</label>
                {u.lessons.map((l) => <label key={l.id} className="block pr-5 text-xs"><input type="checkbox" className="ml-1" checked={lessonIds.includes(l.id)} onChange={(e) => setLessonIds(e.target.checked ? [...lessonIds, l.id] : lessonIds.filter((x) => x !== l.id))} />{l.title}</label>)}
              </div>
            ))}
          </div>
        </details>
        <table className="table">
          <thead><tr><th>المهارة</th><th>نوع السؤال</th><th>الصعوبة</th><th className="w-24">العدد</th><th /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={shortages.some((s) => s.row === i) ? "bg-amber-50" : ""}>
                <td><select className="input" value={r.skillCode} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, skillCode: e.target.value } : x)))} aria-label="المهارة"><option value="">أي مهارة</option>{skills.map((s) => <option key={s.code} value={s.code}>{s.title}</option>)}</select></td>
                <td><select className="input" value={r.type} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} aria-label="النوع"><option value="">أي نوع</option>{QTYPES.map((t) => <option key={t} value={t}>{QTYPE_LABELS[t]}</option>)}</select></td>
                <td><select className="input" value={r.difficulty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, difficulty: e.target.value } : x)))} aria-label="الصعوبة"><option value="">أي مستوى</option><option value="1">سهل</option><option value="2">متوسط</option><option value="3">صعب</option></select></td>
                <td><input className="input text-center" type="number" min={1} max={40} value={r.count} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)))} aria-label="العدد" /></td>
                <td>{rows.length > 1 && <button className="text-xs text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setRows([...rows, { skillCode: "", type: "", difficulty: "", count: 2 }])}>＋ صف</button>
          <button className="btn-primary" onClick={generate} disabled={busy}>{picked ? "🔄 إعادة التوليد" : "⚙️ توليد من البنك"}</button>
        </div>
        {shortages.length > 0 && <p className="text-sm text-amber-700">⚠️ البنك لا يكفي لبعض الصفوف: {shortages.map((s) => `الصف ${s.row + 1} (${s.found} من ${s.wanted})`).join("، ")} — أضيفي أسئلة للبنك أو وسّعي النطاق.</p>}
      </section>

      {msg && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{msg}</div>}

      {picked && picked.length > 0 && (
        <section className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-black">المعاينة — {picked.filter((q) => q.type !== "READING_PASSAGE").length} سؤال · {total} درجة</h2>
            <button className="btn-primary" onClick={save} disabled={busy || !meta.title.trim()}>💾 حفظ وإنشاء {meta.versions > 1 ? `${meta.versions} نماذج` : "النموذج"}</button>
          </div>
          {!meta.title.trim() && <p className="text-xs text-red-600">اكتبي عنوان الاختبار أولاً.</p>}
          <ol className="space-y-2">
            {picked.map((q, i) => (
              <li key={q.id} className={`flex items-start gap-3 rounded-lg border p-3 ${q.parentId ? "mr-6 bg-gray-50" : ""}`}>
                <div className="flex-1"><QuestionCard q={q} /></div>
                {!q.parentId && (
                  <div className="flex shrink-0 gap-1 text-xs">
                    <button aria-label="أعلى" onClick={() => move(i, -1)}>▲</button>
                    <button aria-label="أسفل" onClick={() => move(i, 1)}>▼</button>
                    <button className="text-red-600" onClick={() => remove(q.id)}>حذف</button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="text-xs text-gray-500">في النماذج (ب، ج) يُخلط ترتيب الأسئلة والخيارات تلقائياً، ويبقى النص القرائي مع أسئلته.</p>
        </section>
      )}
    </div>
  );
}
