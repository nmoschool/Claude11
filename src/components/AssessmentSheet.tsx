import type { DisplayQuestion, StoredQuestion } from "@/lib/renderVersion";
import { answerText } from "@/lib/renderVersion";

const LETTERS = "أبجدهو";

/** ورقة الاختبار للطباعة (A4) — كل أنواع الأسئلة؛ answers=true يعرض نموذج الإجابة */
export default function AssessmentSheet({
  title,
  kindLabel,
  versionLabel,
  versionCount,
  total,
  durationMin,
  instructions,
  questions,
  raw,
  answers,
  studentName,
  classLabel,
  schoolName,
}: {
  title: string;
  kindLabel: string;
  versionLabel: string;
  versionCount: number;
  total: number;
  durationMin: number | null;
  instructions: string | null;
  questions: DisplayQuestion[];
  raw: Map<string, StoredQuestion>;
  answers: boolean;
  studentName?: string;
  classLabel?: string;
  schoolName: string;
}) {
  return (
    <article className="assessment-sheet text-[13px] leading-relaxed">
      <header className="mb-3 border-b-2 border-gray-800 pb-2">
        <div className="flex items-start justify-between text-[11px]">
          <div>
            <div className="font-bold">المملكة العربية السعودية — وزارة التعليم</div>
            <div>{schoolName}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black">{title}</div>
            <div>مادة لغتي — الصف الرابع — {kindLabel}</div>
          </div>
          <div className="text-left">
            {versionCount > 1 && <div className="text-base font-black">النموذج ({versionLabel})</div>}
            {durationMin && <div>الزمن: {durationMin} دقيقة</div>}
          </div>
        </div>
        {answers ? (
          <div className="mt-2 rounded bg-green-50 p-1 text-center font-black text-green-800">نموذج الإجابة — للمعلمة فقط</div>
        ) : (
          <div className="mt-2 grid grid-cols-[2fr_1fr_1fr] gap-3 text-[12px]">
            <div>اسم الطالبة: <span className="inline-block min-w-[60%] border-b border-dotted border-gray-500 font-bold">{studentName ?? ""}</span></div>
            <div>الفصل: <span className="inline-block min-w-[40%] border-b border-dotted border-gray-500 font-bold">{classLabel ?? ""}</span></div>
            <div className="flex items-center gap-1">الدرجة: <span className="inline-block h-7 w-12 rounded border border-gray-700" /> / {total}</div>
          </div>
        )}
        {instructions && <p className="mt-2 text-[12px]">📌 {instructions}</p>}
      </header>

      <ol className="space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="break-inside-avoid">
            {q.type === "READING_PASSAGE" ? (
              <div className="rounded border-2 border-gray-400 bg-gray-50 p-3">
                <div className="mb-1 font-black">{q.stem}</div>
                <p className="whitespace-pre-wrap text-justify leading-loose">{q.passage}</p>
              </div>
            ) : (
              <div className={q.parentId ? "pr-4" : ""}>
                <div className="flex gap-2">
                  <span className="font-black">{q.number}.</span>
                  <div className="flex-1">
                    <span className="font-bold">{q.type === "FILL_BLANK" ? q.stem.replace(/_{3,}|\.{3,}|…/, "………………") : q.stem}</span>
                    <span className="mr-2 text-[10px] text-gray-500">({q.points} {q.points === 1 ? "درجة" : "درجات"})</span>
                    <Body q={q} />
                    {answers && <div className="mt-1 rounded bg-green-50 px-2 py-0.5 text-[12px] font-bold text-green-800">✔ {answerText(q, raw.get(q.id)!)}</div>}
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <footer className="mt-6 text-center text-[11px] text-gray-500">انتهت الأسئلة — تمنياتي لكِ بالتوفيق 🌸</footer>
    </article>
  );
}

const Line = ({ n = 1 }: { n?: number }) => (
  <div className="mt-1 space-y-4">
    {Array.from({ length: n }).map((_, i) => <div key={i} className="h-5 border-b border-dotted border-gray-500" />)}
  </div>
);

function Body({ q }: { q: DisplayQuestion }) {
  switch (q.type) {
    case "MCQ":
      return (
        <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1">
          {q.options!.map((o, i) => (
            <div key={o.index} className="flex items-center gap-2"><span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-700 text-[10px]">{LETTERS[i]}</span>{o.text}</div>
          ))}
        </div>
      );
    case "TRUE_FALSE":
      return <span className="mr-3 whitespace-nowrap">( &nbsp; ) صواب &nbsp;&nbsp; ( &nbsp; ) خطأ</span>;
    case "FILL_BLANK":
      return null;
    case "MATCHING":
      return (
        <div className="mt-1 grid grid-cols-2 gap-6">
          <table className="w-full"><tbody>{q.left!.map((l, i) => <tr key={i}><td className="w-6">{i + 1}.</td><td>{l}</td><td className="w-12">( &nbsp;&nbsp; )</td></tr>)}</tbody></table>
          <table className="w-full"><tbody>{q.right!.map((r, i) => <tr key={r.index}><td className="w-6 font-bold">{LETTERS[i] ?? i + 1}</td><td>{r.text}</td></tr>)}</tbody></table>
        </div>
      );
    case "CLASSIFY":
      return (
        <div className="mt-1">
          <div className="mb-1 rounded border border-dashed border-gray-500 p-1 text-center">{q.items!.map((it) => it.text).join(" — ")}</div>
          <table className="w-full border-collapse"><thead><tr>{q.buckets!.map((b) => <th key={b} className="border border-gray-600 p-1">{b}</th>)}</tr></thead>
            <tbody><tr>{q.buckets!.map((b) => <td key={b} className="h-16 border border-gray-600" />)}</tr></tbody></table>
        </div>
      );
    case "ORDER_WORDS":
      return (
        <div className="mt-1">
          <div className="inline-flex flex-wrap gap-2">{q.words!.map((w, i) => <span key={i} className="rounded border border-gray-600 px-2">{w}</span>)}</div>
          <Line />
        </div>
      );
    case "EXTRACT":
      return (
        <div className="mt-1">
          <p className="rounded bg-gray-50 p-2 leading-loose">{q.passage}</p>
          <div className="mt-1 flex flex-wrap gap-4">{Array.from({ length: q.count ?? 1 }).map((_, i) => <span key={i} className="inline-block w-32 border-b border-dotted border-gray-500">&nbsp;</span>)}</div>
        </div>
      );
    case "TRANSFORM":
      return <span className="mr-2">{q.source} ← <span className="inline-block w-40 border-b border-dotted border-gray-500">&nbsp;</span></span>;
    case "DICTATION":
      return <div className="mt-1 text-[11px] text-gray-500">(تُمليها المعلمة) <span className="inline-block w-48 border-b border-dotted border-gray-500">&nbsp;</span></div>;
    case "OPEN":
      return <Line n={q.lines ?? 4} />;
    default:
      return null;
  }
}
