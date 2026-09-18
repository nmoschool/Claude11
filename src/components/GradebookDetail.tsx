"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { letterGrade } from "@/lib/grading";

interface Question {
  id: string;
  order: number;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "WORD_PROBLEM";
  text: string;
  optionsJson: string | null;
  points: number;
  autoGrade: boolean;
}

interface Answer {
  questionId: string;
  responseJson: string | null;
  pointsAwarded: number | null;
}

interface Submission {
  id: string;
  status: string;
  totalScore: number | null;
  maxScore: number | null;
  student: { id: string; fullName: string; studentNumber: string };
  answers: Answer[];
}

export default function GradebookDetail({
  questions,
  submissions,
  worksheetTitle,
}: {
  questions: Question[];
  submissions: Submission[];
  worksheetTitle: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  const maxScore = questions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <h3 className="font-bold text-gray-900">{worksheetTitle}</h3>
        <button onClick={() => window.print()} className="no-print btn-secondary">
          🖨️ طباعة كشف الدرجات
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="p-3 text-right font-bold">الطالب</th>
            <th className="p-3 text-right font-bold">الرقم</th>
            <th className="p-3 text-right font-bold">الحالة</th>
            <th className="p-3 text-right font-bold">الدرجة</th>
            <th className="no-print p-3 text-right font-bold"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {submissions.map((sub) => (
            <SubmissionRow
              key={sub.id}
              submission={sub}
              questions={questions}
              maxScore={maxScore}
              open={openId === sub.id}
              onToggle={() => setOpenId(openId === sub.id ? null : sub.id)}
              onSaved={() => router.refresh()}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubmissionRow({
  submission,
  questions,
  maxScore,
  open,
  onToggle,
  onSaved,
}: {
  submission: Submission;
  questions: Question[];
  maxScore: number;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const initialResponses = useMemo(() => {
    const map: Record<string, { response?: string; manualPoints?: number }> = {};
    submission.answers.forEach((a) => {
      map[a.questionId] = {
        response: a.responseJson ? JSON.parse(a.responseJson) : undefined,
        manualPoints: a.pointsAwarded ?? undefined,
      };
    });
    return map;
  }, [submission.answers]);

  const [responses, setResponses] = useState(initialResponses);
  const [saving, setSaving] = useState(false);

  const percent =
    submission.totalScore != null && submission.maxScore
      ? (submission.totalScore / submission.maxScore) * 100
      : null;
  const grade = percent != null ? letterGrade(percent) : null;

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/submissions/${submission.id}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses }),
    });
    setSaving(false);
    if (res.ok) onSaved();
  }

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="p-3 font-bold text-gray-900">{submission.student.fullName}</td>
        <td className="p-3 text-gray-600" dir="ltr">{submission.student.studentNumber}</td>
        <td className="p-3">
          <span className={`badge ${grade ? grade.color : "bg-gray-100 text-gray-500"}`}>
            {grade ? grade.label : "لم يُصحح"}
          </span>
        </td>
        <td className="p-3 font-bold">
          {submission.totalScore != null ? `${submission.totalScore} / ${submission.maxScore}` : `— / ${maxScore}`}
        </td>
        <td className="no-print p-3">
          <button onClick={onToggle} className="text-xs font-bold text-brand-700 hover:underline">
            {open ? "إغلاق" : "تصحيح"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="no-print">
          <td colSpan={5} className="bg-gray-50 p-4">
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-sm font-bold text-gray-800">
                    {q.order}. {q.text} <span className="text-xs text-gray-400">({q.points} درجة)</span>
                  </p>

                  {q.type === "MULTIPLE_CHOICE" && (
                    <select
                      className="input"
                      value={responses[q.id]?.response ?? ""}
                      onChange={(e) =>
                        setResponses({ ...responses, [q.id]: { response: e.target.value } })
                      }
                    >
                      <option value="">— اختر إجابة الطالب —</option>
                      {(q.optionsJson ? JSON.parse(q.optionsJson) : []).map((opt: string, i: number) => (
                        <option key={i} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {q.type === "TRUE_FALSE" && (
                    <select
                      className="input"
                      value={responses[q.id]?.response ?? ""}
                      onChange={(e) =>
                        setResponses({ ...responses, [q.id]: { response: e.target.value } })
                      }
                    >
                      <option value="">— اختر إجابة الطالب —</option>
                      <option value="صح">صح</option>
                      <option value="خطأ">خطأ</option>
                    </select>
                  )}

                  {q.type === "FILL_BLANK" && (
                    <input
                      className="input"
                      placeholder="إجابة الطالب"
                      value={responses[q.id]?.response ?? ""}
                      onChange={(e) =>
                        setResponses({ ...responses, [q.id]: { response: e.target.value } })
                      }
                    />
                  )}

                  {q.type === "WORD_PROBLEM" && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">الدرجة الممنوحة:</label>
                      <input
                        type="number"
                        min={0}
                        max={q.points}
                        step={0.5}
                        className="input w-24"
                        value={responses[q.id]?.manualPoints ?? ""}
                        onChange={(e) =>
                          setResponses({
                            ...responses,
                            [q.id]: { manualPoints: Number(e.target.value) },
                          })
                        }
                      />
                      <span className="text-xs text-gray-400">/ {q.points}</span>
                    </div>
                  )}
                </div>
              ))}
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "جارِ الحفظ..." : "حفظ التصحيح"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
