"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/apiClient";
import { QTYPE_LABELS, QTYPES } from "@/lib/questionTypes";
import { GENERATOR_KINDS, type Draft, type GeneratorKind } from "@/lib/vocabGenerators";
import QuestionEditor, { type BankQuestion } from "@/components/QuestionEditor";
import QuestionCard from "@/components/QuestionCard";

interface Skill { code: string; title: string; domain: string }
interface Row extends BankQuestion { skillTitle: string | null; lessonTitle: string | null; childCount: number }
const DIFF = ["", "سهل", "متوسط", "صعب"];

export default function QuestionBank({ skills, lessons, canEdit }: { skills: Skill[]; lessons: { id: string; title: string }[]; canEdit: boolean }) {
  const [filters, setFilters] = useState({ q: "", type: "", skill: "", difficulty: "", status: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [children, setChildren] = useState<Record<string, Row[]>>({});
  const [edit, setEdit] = useState<{ q: BankQuestion | null; parentId?: string } | null>(null);
  const [gen, setGen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const r = await api(`/api/v1/questions?${qs}`);
    setRows(r.questions);
    setTotal(r.total);
  }, [filters]);
  useEffect(() => { load().catch((e) => setMsg({ ok: false, text: e.message })); }, [load]);

  async function loadChildren(id: string) {
    const r = await api(`/api/v1/questions?parent=${id}`);
    setChildren((c) => ({ ...c, [id]: r.questions }));
  }
  const done = (text: string) => { setEdit(null); setMsg({ ok: true, text }); load(); Object.keys(children).forEach(loadChildren); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black">بنك الأسئلة</h1>
          <p className="text-sm text-gray-500">{total} سؤال · <Link href="/dashboard/assessments" className="text-brand-700 underline">الاختبارات</Link></p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => setEdit({ q: null })}>＋ سؤال</button>
            <button className="btn-secondary" onClick={() => setGen(!gen)}>⚙️ توليد من المفردات</button>
          </div>
        )}
      </div>
      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</div>}
      {gen && canEdit && <VocabGenerator lessons={lessons} onSaved={(n) => { setGen(false); done(`أُضيف ${n} سؤال إلى البنك`); }} onError={(t) => setMsg({ ok: false, text: t })} />}

      <div className="card flex flex-wrap gap-2 p-3">
        <input className="input w-56" placeholder="بحث في نص السؤال" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} aria-label="بحث" />
        <select className="input w-auto" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} aria-label="النوع"><option value="">كل الأنواع</option>{QTYPES.map((t) => <option key={t} value={t}>{QTYPE_LABELS[t]}</option>)}</select>
        <select className="input w-auto" value={filters.skill} onChange={(e) => setFilters({ ...filters, skill: e.target.value })} aria-label="المهارة"><option value="">كل المهارات</option>{skills.map((s) => <option key={s.code} value={s.code}>{s.title}</option>)}</select>
        <select className="input w-auto" value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })} aria-label="الصعوبة"><option value="">كل المستويات</option><option value="1">سهل</option><option value="2">متوسط</option><option value="3">صعب</option></select>
        <select className="input w-auto" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} aria-label="الحالة"><option value="">معتمد ومسودة</option><option value="APPROVED">معتمد</option><option value="DRAFT">مسودة</option></select>
      </div>

      <div className="space-y-2">
        {rows.map((q) => (
          <div key={q.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1"><QuestionCard q={q} /></div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                <div className="flex gap-1">
                  {q.status === "DRAFT" && <span className="badge bg-amber-50 text-amber-700">مسودة</span>}
                  <span className="badge bg-gray-100 text-gray-600">{DIFF[q.difficulty]}</span>
                  {q.type !== "READING_PASSAGE" && <span className="badge bg-brand-50 text-brand-700">{q.points} د</span>}
                </div>
                {q.skillTitle && <span className="text-gray-500">{q.skillTitle}</span>}
                {q.lessonTitle && <span className="max-w-[14rem] truncate text-gray-400">{q.lessonTitle}</span>}
                {canEdit && (
                  <div className="mt-1 flex gap-2">
                    <button className="text-brand-700" onClick={() => setEdit({ q })}>تعديل</button>
                    <button className="text-red-600" onClick={() => confirm("حذف السؤال؟ (يُؤرشف إن كان مستخدماً في اختبار)") && api(`/api/v1/questions/${q.id}`, "DELETE").then((r) => done(r.archived ? "أُرشف السؤال لأنه مستخدم في اختبار" : "تم الحذف"), (e) => setMsg({ ok: false, text: e.message }))}>حذف</button>
                  </div>
                )}
              </div>
            </div>
            {q.type === "READING_PASSAGE" && (
              <div className="mt-3 border-t pt-3">
                <div className="mb-2 flex gap-2 text-xs">
                  <button className="text-brand-700" onClick={() => (children[q.id] ? setChildren((c) => { const n = { ...c }; delete n[q.id]; return n; }) : loadChildren(q.id))}>{children[q.id] ? "إخفاء" : `عرض`} أسئلة النص ({q.childCount})</button>
                  {canEdit && <button className="text-brand-700" onClick={() => setEdit({ q: null, parentId: q.id })}>＋ سؤال للنص</button>}
                </div>
                {children[q.id]?.map((c) => (
                  <div key={c.id} className="mb-2 flex items-start gap-2 rounded bg-gray-50 p-2 pr-4">
                    <div className="flex-1"><QuestionCard q={c} /></div>
                    {canEdit && <button className="text-xs text-brand-700" onClick={() => setEdit({ q: c })}>تعديل</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {!rows.length && <p className="py-10 text-center text-gray-400">لا توجد أسئلة مطابقة.</p>}
      </div>

      {edit && <QuestionEditor question={edit.q} parentId={edit.parentId} skills={skills} lessons={lessons} onClose={() => setEdit(null)} onSaved={done} />}
    </div>
  );
}

function VocabGenerator({ lessons, onSaved, onError }: { lessons: { id: string; title: string }[]; onSaved: (n: number) => void; onError: (t: string) => void }) {
  const [kind, setKind] = useState<GeneratorKind>("SHAMS_QAMAR");
  const [count, setCount] = useState(3);
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<(Draft & { keep: boolean })[] | null>(null);

  async function run() {
    try {
      const r = await api("/api/v1/questions/generate", "POST", { kind, count, lessonIds });
      if (!r.drafts.length) onError(`لم تكفِ المفردات (${r.vocabCount} مفردة) لتوليد هذا النوع؛ أضيفي مفردات للدروس`);
      setDrafts(r.drafts.map((d: Draft) => ({ ...d, keep: true })));
    } catch (e) {
      onError((e as Error).message);
    }
  }
  async function save() {
    const keep = drafts!.filter((d) => d.keep);
    try {
      await api("/api/v1/questions", "POST", { questions: keep.map(({ keep: _k, ...d }) => ({ ...d, status: "APPROVED" })) });
      onSaved(keep.length);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-black">توليد أسئلة من قاموس مفردات المنهج</h2>
      <p className="text-sm text-gray-500">مولّد قواعدي: يُصنّف اللام الشمسية/القمرية والتاء من الكلمة نفسها، ويستخدم المثنى والجمع والأضداد والمعاني المسجّلة في المفردات. راجعي المسودات قبل الحفظ.</p>
      <div className="flex flex-wrap gap-2">
        <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value as GeneratorKind)} aria-label="النوع">{Object.entries(GENERATOR_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className="input w-24" type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="العدد" />
        <select className="input w-72" multiple value={lessonIds} onChange={(e) => setLessonIds(Array.from(e.target.selectedOptions, (o) => o.value))} aria-label="الدروس (اختياري)" size={3}>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <button className="btn-secondary" onClick={run}>توليد مسودات</button>
      </div>
      {drafts && (
        <>
          {drafts.map((d, i) => (
            <label key={i} className="flex items-start gap-2 rounded-lg border p-3">
              <input type="checkbox" className="mt-1" checked={d.keep} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} />
              <QuestionCard q={d} />
            </label>
          ))}
          {drafts.length > 0 && <button className="btn-primary" onClick={save} disabled={!drafts.some((d) => d.keep)}>حفظ المحدد في البنك</button>}
        </>
      )}
    </div>
  );
}
