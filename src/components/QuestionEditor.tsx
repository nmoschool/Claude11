"use client";

import { QuestionDraft, QUESTION_TYPE_LABELS, QuestionType } from "@/types";

interface Props {
  question: QuestionDraft;
  index: number;
  onChange: (q: QuestionDraft) => void;
  onRemove: () => void;
}

export default function QuestionEditor({ question, index, onChange, onRemove }: Props) {
  function setType(type: QuestionType) {
    onChange({
      ...question,
      type,
      options: type === "MULTIPLE_CHOICE" ? question.options ?? ["", "", ""] : undefined,
      autoGrade: type !== "WORD_PROBLEM",
      correct: "",
    });
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="badge bg-gray-100 text-gray-700">السؤال {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-bold text-red-600 hover:underline"
        >
          حذف
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">نوع السؤال</label>
          <select
            className="input"
            value={question.type}
            onChange={(e) => setType(e.target.value as QuestionType)}
          >
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">الدرجة</label>
          <input
            type="number"
            min={0.5}
            step={0.5}
            className="input"
            value={question.points}
            onChange={(e) => onChange({ ...question, points: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <label className="label">نص السؤال</label>
        <textarea
          className="input"
          rows={2}
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="مثال: ٧ + ٥ = ____ أو اكتب السؤال هنا"
        />
      </div>

      {question.type === "MULTIPLE_CHOICE" && (
        <div className="space-y-2">
          <label className="label">الخيارات (حدد الإجابة الصحيحة)</label>
          {(question.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${question.clientId}`}
                checked={question.correct === opt && opt !== ""}
                onChange={() => onChange({ ...question, correct: opt })}
              />
              <input
                className="input"
                value={opt}
                onChange={(e) => {
                  const options = [...(question.options ?? [])];
                  const oldValue = options[i];
                  options[i] = e.target.value;
                  onChange({
                    ...question,
                    options,
                    correct: question.correct === oldValue ? e.target.value : question.correct,
                  });
                }}
                placeholder={`خيار ${i + 1}`}
              />
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-red-600"
                onClick={() => {
                  const options = (question.options ?? []).filter((_, idx) => idx !== i);
                  onChange({ ...question, options });
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-bold text-brand-700 hover:underline"
            onClick={() =>
              onChange({ ...question, options: [...(question.options ?? []), ""] })
            }
          >
            ＋ إضافة خيار
          </button>
        </div>
      )}

      {question.type === "TRUE_FALSE" && (
        <div>
          <label className="label">الإجابة الصحيحة</label>
          <div className="flex gap-4">
            {["صح", "خطأ"].map((v) => (
              <label key={v} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={`tf-${question.clientId}`}
                  checked={question.correct === v}
                  onChange={() => onChange({ ...question, correct: v })}
                />
                {v}
              </label>
            ))}
          </div>
        </div>
      )}

      {question.type === "FILL_BLANK" && (
        <div>
          <label className="label">الإجابة الصحيحة</label>
          <input
            className="input"
            value={question.correct}
            onChange={(e) => onChange({ ...question, correct: e.target.value })}
            placeholder="الإجابة (رقم أو كلمة)"
          />
        </div>
      )}

      {question.type === "WORD_PROBLEM" && (
        <div>
          <label className="label">نموذج الإجابة / معايير التصحيح (اختياري - للمعلم فقط)</label>
          <input
            className="input"
            value={question.correct}
            onChange={(e) => onChange({ ...question, correct: e.target.value })}
            placeholder="ملاحظات تساعد على التصحيح اليدوي"
          />
        </div>
      )}
    </div>
  );
}
