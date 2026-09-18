"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionDraft } from "@/types";
import { emptyQuestion, generateArithmeticQuestions } from "@/lib/worksheetGenerator";
import QuestionEditor from "@/components/QuestionEditor";

interface UnitOption {
  id: string;
  grade: number;
  title: string;
}

export default function WorksheetForm({ units }: { units: UnitOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<"WORKSHEET" | "QUIZ">("WORKSHEET");
  const [grade, setGrade] = useState(1);
  const [unitId, setUnitId] = useState("");
  const [duration, setDuration] = useState(20);
  const [instructions, setInstructions] = useState(
    "بسم الله الرحمن الرحيم، اقرأ السؤال جيداً ثم أجب بخط واضح."
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [genOp, setGenOp] = useState<"add" | "sub" | "mixed">("add");
  const [genCount, setGenCount] = useState(10);
  const [genMin, setGenMin] = useState(1);
  const [genMax, setGenMax] = useState(grade === 1 ? 10 : 100);

  const filteredUnits = useMemo(() => units.filter((u) => u.grade === grade), [units, grade]);

  function updateQuestion(index: number, q: QuestionDraft) {
    const next = [...questions];
    next[index] = q;
    setQuestions(next);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function addManualQuestion() {
    setQuestions([...questions, emptyQuestion()]);
  }

  function autoGenerate() {
    const generated = generateArithmeticQuestions({
      operation: genOp,
      count: genCount,
      min: genMin,
      max: genMax,
    });
    setQuestions([...questions, ...generated]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("الرجاء إدخال عنوان الورقة/الاختبار");
    if (questions.length === 0) return setError("أضف سؤالاً واحداً على الأقل");
    for (const q of questions) {
      if (!q.text.trim()) return setError("توجد أسئلة بدون نص");
      if (q.type !== "WORD_PROBLEM" && !q.correct.trim())
        return setError("حدد الإجابة الصحيحة لجميع الأسئلة القابلة للتصحيح التلقائي");
    }

    setSaving(true);
    const res = await fetch("/api/worksheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        type: docType,
        grade,
        unitId: unitId || null,
        durationMinutes: duration,
        instructions,
        questions: questions.map((q) => ({
          type: q.type,
          text: q.text,
          options: q.options,
          correct: q.correct,
          points: q.points,
          autoGrade: q.autoGrade,
        })),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      setError("تعذر الحفظ، تحقق من البيانات المدخلة");
      return;
    }

    const created = await res.json();
    router.push(`/dashboard/worksheets/${created.id}`);
  }

  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="label">العنوان</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: ورقة عمل - الجمع ضمن 10"
          />
        </div>
        <div>
          <label className="label">النوع</label>
          <select
            className="input"
            value={docType}
            onChange={(e) => setDocType(e.target.value as "WORKSHEET" | "QUIZ")}
          >
            <option value="WORKSHEET">ورقة عمل</option>
            <option value="QUIZ">اختبار قصير</option>
          </select>
        </div>
        <div>
          <label className="label">الزمن (دقيقة)</label>
          <input
            type="number"
            min={5}
            className="input"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">الصف</label>
          <select
            className="input"
            value={grade}
            onChange={(e) => {
              setGrade(Number(e.target.value));
              setUnitId("");
            }}
          >
            <option value={1}>الأول الابتدائي</option>
            <option value={2}>الثاني الابتدائي</option>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="label">الوحدة (اختياري)</label>
          <select className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">بدون ربط بوحدة محددة</option>
            {filteredUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.title}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label">تعليمات الورقة</label>
          <input
            className="input"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
      </div>

      <div className="card space-y-3 border-2 border-dashed border-brand-200 bg-brand-50/40 p-5">
        <h3 className="font-bold text-brand-800">⚡ توليد تلقائي لمسائل حسابية</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">العملية</label>
            <select
              className="input"
              value={genOp}
              onChange={(e) => setGenOp(e.target.value as any)}
            >
              <option value="add">جمع</option>
              <option value="sub">طرح</option>
              <option value="mixed">مختلط</option>
            </select>
          </div>
          <div>
            <label className="label">عدد الأسئلة</label>
            <input
              type="number"
              min={1}
              max={40}
              className="input"
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">من</label>
            <input
              type="number"
              className="input"
              value={genMin}
              onChange={(e) => setGenMin(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">إلى</label>
            <input
              type="number"
              className="input"
              value={genMax}
              onChange={(e) => setGenMax(Number(e.target.value))}
            />
          </div>
        </div>
        <button type="button" onClick={autoGenerate} className="btn-accent">
          توليد الأسئلة وإضافتها
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">
            الأسئلة ({questions.length}) — إجمالي الدرجات: {totalPoints}
          </h3>
          <button type="button" onClick={addManualQuestion} className="btn-secondary">
            ＋ إضافة سؤال يدوياً
          </button>
        </div>

        {questions.map((q, i) => (
          <QuestionEditor
            key={q.clientId}
            question={q}
            index={i}
            onChange={(nq) => updateQuestion(i, nq)}
            onRemove={() => removeQuestion(i)}
          />
        ))}

        {questions.length === 0 && (
          <div className="card p-8 text-center text-gray-400">
            لا توجد أسئلة بعد. استخدم التوليد التلقائي أو أضف سؤالاً يدوياً.
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "جارِ الحفظ..." : "حفظ الورقة"}
        </button>
      </div>
    </form>
  );
}
