import { QUESTION_TYPE_LABELS, QuestionType } from "@/types";

interface Question {
  id: string;
  order: number;
  type: string;
  text: string;
  optionsJson: string | null;
  points: number;
}

interface Props {
  title: string;
  type: "WORKSHEET" | "QUIZ";
  grade: number;
  durationMinutes: number;
  instructions: string | null;
  unitTitle?: string | null;
  questions: Question[];
  schoolName?: string;
  hijriYear?: string;
  showAnswerKey?: boolean;
}

export default function WorksheetPrintView({
  title,
  type,
  grade,
  durationMinutes,
  instructions,
  unitTitle,
  questions,
  schoolName = "مدرستي الابتدائية",
  hijriYear = "1448",
}: Props) {
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="print-page card mx-auto max-w-3xl bg-white p-8 print:shadow-none">
      <div className="mb-4 flex items-start justify-between border-b-2 border-brand-600 pb-3">
        <div>
          <div className="text-lg font-black text-brand-800">{schoolName}</div>
          <div className="text-xs text-gray-500">
            مادة الرياضيات - الصف {grade === 1 ? "الأول" : "الثاني"} الابتدائي - عام {hijriYear}هـ
          </div>
        </div>
        <div className="text-left text-xs text-gray-500">
          <div>الزمن: {durationMinutes} دقيقة</div>
          <div>الدرجة الكلية: {totalPoints}</div>
        </div>
      </div>

      <h1 className="mb-2 text-center text-xl font-black text-gray-900">
        {type === "QUIZ" ? "اختبار قصير" : "ورقة عمل"}: {title}
      </h1>
      {unitTitle && (
        <p className="mb-3 text-center text-sm text-gray-500">الوحدة: {unitTitle}</p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 rounded-lg border border-gray-200 p-3 text-sm">
        <div>
          اسم الطالب: <span className="inline-block w-40 border-b border-gray-400">&nbsp;</span>
        </div>
        <div>
          الفصل: <span className="inline-block w-24 border-b border-gray-400">&nbsp;</span>
        </div>
        <div>
          التاريخ: <span className="inline-block w-40 border-b border-gray-400">&nbsp;</span>
        </div>
        <div>
          الدرجة: <span className="inline-block w-24 border-b border-gray-400">&nbsp;</span>
          / {totalPoints}
        </div>
      </div>

      {instructions && (
        <p className="mb-5 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {instructions}
        </p>
      )}

      <ol className="space-y-5">
        {questions.map((q) => {
          const options: string[] = q.optionsJson ? JSON.parse(q.optionsJson) : [];
          return (
            <li key={q.id} className="break-inside-avoid">
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="font-bold text-gray-900">
                  {q.order}. {q.text}
                </p>
                <span className="shrink-0 text-xs text-gray-400">({q.points} درجة)</span>
              </div>

              {q.type === "MULTIPLE_CHOICE" && (
                <div className="mr-6 grid grid-cols-2 gap-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-400 text-xs">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </div>
                  ))}
                </div>
              )}

              {q.type === "TRUE_FALSE" && (
                <div className="mr-6 flex gap-6 text-sm">
                  <span>( &nbsp; ) صح</span>
                  <span>( &nbsp; ) خطأ</span>
                </div>
              )}

              {q.type === "FILL_BLANK" && (
                <div className="mr-6 text-sm text-gray-400">الإجابة: ______________</div>
              )}

              {q.type === "WORD_PROBLEM" && (
                <div className="mr-6 mt-2 h-16 rounded border border-dashed border-gray-300" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
