import { QTYPE_LABELS, type QType } from "@/lib/questionTypes";

/** معاينة سؤال من البنك (مع الإجابة الصحيحة) — آمن للمتصفح */
export default function QuestionCard({ q }: { q: { type: QType; stem: string; payload: any; answerKey: any } }) {
  const p = q.payload ?? {};
  const k = q.answerKey ?? {};
  const ok = "rounded bg-mint-50 px-1.5 font-bold text-mint-700";
  return (
    <div className="text-sm">
      <div className="font-bold">{q.stem}</div>
      {q.type === "MCQ" && <div className="mt-1 flex flex-wrap gap-2">{p.options.map((o: string, i: number) => <span key={i} className={i === k.correct ? ok : "rounded bg-gray-50 px-1.5"}>{o}</span>)}</div>}
      {q.type === "TRUE_FALSE" && <div className="mt-1"><span className={ok}>{k.correct ? "صواب" : "خطأ"}</span></div>}
      {["FILL_BLANK", "TRANSFORM", "DICTATION"].includes(q.type) && (
        <div className="mt-1 text-xs">{q.type === "TRANSFORM" && <>{p.source} ← </>}{q.type === "DICTATION" && <>🔊 «{p.say}» ← </>}<span className={ok}>{k.accepted.join(" / ")}</span> <span className="text-gray-400">({k.mode === "spelling" ? "إملائية صارمة" : "متساهلة"})</span></div>
      )}
      {q.type === "MATCHING" && <div className="mt-1 text-xs">{p.left.map((l: string, i: number) => <span key={i} className="ml-3">{l} ← <b>{p.right[k.pairs[i]]}</b></span>)}</div>}
      {q.type === "CLASSIFY" && <div className="mt-1 text-xs">{p.buckets.map((b: string, bi: number) => <div key={bi}><b>{b}:</b> {p.items.filter((_: string, i: number) => k.bucketOf[i] === bi).join("، ")}</div>)}</div>}
      {q.type === "ORDER_WORDS" && <div className="mt-1 text-xs">{k.sentences.map((s: string[], i: number) => <div key={i} className={ok + " mb-0.5 inline-block"}>{s.join(" ")}</div>)}</div>}
      {q.type === "EXTRACT" && <div className="mt-1 text-xs"><p className="text-gray-600">{p.passage}</p>المطلوب {k.count}: <span className={ok}>{k.accepted.join("، ")}</span></div>}
      {q.type === "OPEN" && <div className="mt-1 text-xs text-gray-500">✍️ تصحيح يدوي{k.sample && <> — نموذجية: {k.sample}</>}</div>}
      {q.type === "READING_PASSAGE" && <p className="mt-1 line-clamp-3 rounded bg-amber-50 p-2 text-xs leading-relaxed">{p.passage}</p>}
      <div className="mt-1 text-[10px] text-gray-400">{QTYPE_LABELS[q.type]}</div>
    </div>
  );
}
