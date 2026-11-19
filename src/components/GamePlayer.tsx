"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GAMES, ROUNDS_PER_SESSION, adaptLevel, buildRound, hintFor, type GameCode, type GameContent, type Round } from "@/lib/games";
import { enqueue, flush, getLevel, loadPack, refreshPack, setLevel as storeLevel, uuid } from "@/lib/offlineStore";
import { normalizeAr } from "@/lib/arabicNormalize";
import { praise, say, sfx } from "@/lib/sfx";
import { mulberry32, shuffle } from "@/lib/generator";

type Feedback = { ok: boolean; correctText?: string } | null;
const LEVEL_NAMES = { 1: "سهل", 2: "متوسط", 3: "متقدم" } as const;

export default function GamePlayer({ studentId, code }: { studentId: string; code: GameCode }) {
  const G = GAMES[code];
  const [content, setContent] = useState<GameContent | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [roundNo, setRoundNo] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [history, setHistory] = useState<boolean[]>([]);
  const [hints, setHints] = useState(0);
  const [removed, setRemoved] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState<null | { server: any | null }>(null);
  const [levelUp, setLevelUp] = useState(false);
  const started = useRef(Date.now());
  const recent = useRef(new Set<string>());
  const seedBase = useRef(Math.floor(Math.random() * 1e9));

  useEffect(() => {
    setLevel(getLevel(studentId, code));
    const cached = loadPack(studentId);
    if (cached) {
      setContent(cached.content);
      if (!cached.enabled.includes(code)) setBlocked(true);
    }
    refreshPack(studentId).then((p) => {
      if (!p) return;
      setContent((c) => c ?? p.content);
      setBlocked(!p.enabled.includes(code));
    });
  }, [studentId, code]);

  const next = useCallback(
    (lvl: 1 | 2 | 3, n: number) => {
      if (!content) return;
      const r = buildRound(code, content, lvl, seedBase.current + n * 7919, recent.current);
      if (r && r.kind !== "memory") recent.current.add(r.ref);
      if (recent.current.size > 12) recent.current = new Set(Array.from(recent.current).slice(-8));
      setRound(r);
      setHints(0);
      setRemoved([]);
      setFeedback(null);
      started.current = Date.now();
      if (r?.kind === "type") setTimeout(() => say(r.say, 0.7), 300);
    },
    [code, content]
  );
  useEffect(() => {
    if (content && !round && !done) next(level, 0);
  }, [content, round, done, level, next]);

  /** تسجيل محاولة في الطابور المحلي (تُزامَن لاحقاً) */
  const record = useCallback(
    (ok: boolean, ref: string, skill: string, lvl: number, hintsUsed: number) => {
      enqueue(studentId, { clientId: uuid(), gameCode: code, skillCode: skill, itemRef: ref, correct: ok, hintsUsed, ms: Date.now() - started.current, level: lvl, playedAt: new Date().toISOString() });
    },
    [studentId, code]
  );

  const answer = useCallback(
    (ok: boolean, correctText?: string, alreadyRecorded = false) => {
      if (!round || feedback) return;
      // بطاقات الذاكرة تسجّل كل محاولة مطابقة على حدة، فلا تُسجَّل اللوحة مرة أخرى
      if (!alreadyRecorded) record(ok, round.ref, round.skill, level, hints);
      ok ? (sfx.correct(), praise()) : (sfx.wrong(), say("حاولي في المرة القادمة"));
      setFeedback({ ok, correctText });
      if (ok) setCorrectCount((c) => c + 1);
      const h = [...history, ok];
      setHistory(h);
      const nl = adaptLevel(level, h);
      if (nl > level) { setLevelUp(true); sfx.levelUp(); setTimeout(() => setLevelUp(false), 1800); }
      if (nl !== level) { setLevel(nl); storeLevel(studentId, code, nl); setHistory([]); }
      setTimeout(async () => {
        const n = roundNo + 1;
        if (n >= ROUNDS_PER_SESSION) {
          const server = await flush(studentId);
          setDone({ server });
          if (server?.newBadges?.length) say(`مبروك! حصلتِ على وسام ${server.newBadges[0].title}`);
        } else {
          setRoundNo(n);
          next(nl, n);
        }
      }, ok ? 900 : 1800);
    },
    [round, feedback, record, level, hints, history, roundNo, next, studentId, code]
  );

  function giveHint() {
    if (!round || feedback) return;
    const h = hintFor(round, removed);
    setHints((x) => x + 1);
    if (h.removeChoice !== undefined) setRemoved([...removed, h.removeChoice]);
  }

  if (blocked) return <Shell code={code}><Card><p className="text-2xl">هذه اللعبة غير مفعّلة لفصلك الآن 🌈</p></Card></Shell>;
  if (!content || (!round && !done)) return <Shell code={code}><p className="text-center text-3xl">⏳</p></Shell>;

  if (done) {
    const s = done.server;
    return (
      <Shell code={code}>
        <Card>
          <div className="text-7xl">{correctCount >= 8 ? "🏆" : correctCount >= 5 ? "🌟" : "💪"}</div>
          <h1 className="mt-3 text-3xl font-black text-brand-800">{correctCount >= 8 ? "مذهلة!" : correctCount >= 5 ? "أحسنتِ!" : "أداء جميل، واصلي التدريب!"}</h1>
          <p className="mt-3 text-2xl">{correctCount} إجابات صحيحة من {ROUNDS_PER_SESSION}</p>
          {s ? (
            <>
              <p className="mt-2 text-xl">+{s.pointsAdded} نقطة ⭐ — مجموعك {s.totalPoints} ({s.level.icon} {s.level.title})</p>
              {s.dailyCapReached && <p className="mt-1 text-sm text-gray-500">بلغتِ حد نقاط اليوم — تابعي التدريب وستُحسب نقاط جديدة غداً</p>}
              {s.newBadges?.map((b: any) => <div key={b.code} className="mt-3 rounded-2xl bg-amber-50 p-3 text-xl font-black">🎖️ وسام جديد: {b.icon} {b.title}</div>)}
              {s.newCertificates?.map((c: any) => <Link key={c.id} href={`/student/certificates/${c.id}`} className="mt-2 block rounded-2xl bg-mint-50 p-3 text-lg font-bold text-mint-700">📜 {c.title} — اعرضيها</Link>)}
            </>
          ) : (
            <p className="mt-2 text-gray-500">📶 ستُحتسب نقاطك عند عودة الاتصال</p>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button className="rounded-2xl bg-brand-600 px-6 py-3 text-xl font-black text-white" onClick={() => { setDone(null); setRoundNo(0); setCorrectCount(0); setRound(null); seedBase.current = Math.floor(Math.random() * 1e9); }}>العبي مرة أخرى 🔁</button>
            <Link href="/student/games" className="rounded-2xl bg-white px-6 py-3 text-xl font-bold shadow">ألعاب أخرى</Link>
          </div>
        </Card>
      </Shell>
    );
  }

  const r = round!;
  return (
    <Shell code={code}>
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/80 px-4 py-2">
        <span className="font-bold">الجولة {roundNo + 1} / {ROUNDS_PER_SESSION}</span>
        <span className="flex gap-1" role="img" aria-label={`الجولة ${roundNo + 1} من ${ROUNDS_PER_SESSION}`}>{Array.from({ length: ROUNDS_PER_SESSION }).map((_, i) => <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < roundNo ? "bg-brand-500" : i === roundNo ? "bg-accent-500" : "bg-gray-200"}`} />)}</span>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">المستوى: {LEVEL_NAMES[level]}</span>
      </div>
      {levelUp && <div className="mb-3 animate-bounce rounded-2xl bg-amber-100 p-3 text-center text-xl font-black text-amber-800">🚀 انتقلتِ إلى مستوى أعلى!</div>}
      <Card>
        {r.kind === "choice" && <ChoiceRound r={r} removed={removed} feedback={feedback} onAnswer={(i) => answer(i === r.answer, r.choices[r.answer])} key={r.ref + roundNo} />}
        {r.kind === "order" && <OrderRound r={r} feedback={feedback} hintWord={hints > 0 ? r.orders[0][0] : null} onAnswer={(ok) => answer(ok, r.orders[0].join(" "))} key={r.ref + roundNo} />}
        {r.kind === "type" && <TypeRound r={r} feedback={feedback} hintLetter={hints > 0 ? r.answer[0] : null} onAnswer={(ok) => answer(ok, r.answer)} key={r.ref + roundNo} />}
        {r.kind === "memory" && (
          <MemoryRound
            r={r}
            seed={seedBase.current + roundNo}
            onPair={(ok, ref) => { record(ok, ref, r.skill, level, hints); ok ? sfx.correct() : sfx.wrong(); }}
            onDone={() => answer(true, undefined, true)}
            key={r.ref + roundNo}
          />
        )}
        {feedback && (
          <div className={`mt-5 rounded-2xl p-3 text-2xl font-black ${feedback.ok ? "bg-mint-50 text-mint-700" : "bg-amber-50 text-amber-800"}`} role="status">
            {feedback.ok ? "✔️ صحيح!" : <>الإجابة الصحيحة: <span className="text-brand-700">{feedback.correctText}</span></>}
          </div>
        )}
        {!feedback && r.kind !== "memory" && (
          <button className="mt-5 rounded-2xl bg-amber-100 px-4 py-2 text-lg font-bold text-amber-800 disabled:opacity-40" onClick={giveHint} disabled={hints >= (r.kind === "choice" ? Math.max(0, r.choices.length - 2) : 1)}>💡 تلميح</button>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ code, children }: { code: GameCode; children: React.ReactNode }) {
  const G = GAMES[code];
  return (
    <div className={`min-h-screen bg-gradient-to-b ${G.color} px-4 py-6`}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between text-white">
          <h1 className="text-2xl font-black drop-shadow">{G.icon} {G.title}</h1>
          <Link href="/student/games" className="rounded-2xl bg-white/90 px-4 py-2 font-bold text-gray-700">✕ خروج</Link>
        </div>
        {children}
      </div>
    </div>
  );
}

const Card = ({ children }: { children: React.ReactNode }) => <div className="rounded-3xl bg-white p-6 text-center shadow-xl">{children}</div>;

function ChoiceRound({ r, removed, feedback, onAnswer }: { r: Extract<Round, { kind: "choice" }>; removed: number[]; feedback: Feedback; onAnswer: (i: number) => void }) {
  const [left, setLeft] = useState(r.timer ?? 0);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    if (!r.timer || feedback) return;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [r.timer, feedback]);
  useEffect(() => {
    if (r.timer && left <= 0 && !feedback) onAnswer(-1);
  }, [left, r.timer, feedback, onAnswer]);
  return (
    <div>
      {r.sub && <p className="text-lg text-gray-500">{r.sub}</p>}
      <div className="my-4 flex items-center justify-center gap-3">
        <span className="text-6xl font-black tracking-wide text-gray-900">{r.prompt}</span>
        <button className="text-3xl" aria-label="استمعي" onClick={() => say(r.prompt.replace("ـ؟", ""))}>🔊</button>
      </div>
      {r.timer && !feedback && <div className="mx-auto mb-3 h-2 w-48 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-accent-500 transition-all" style={{ width: `${(left / r.timer) * 100}%` }} /></div>}
      <div className={`grid gap-3 ${r.choices.length > 2 ? "sm:grid-cols-2" : "grid-cols-2"}`}>
        {r.choices.map((c, i) => {
          const gone = removed.includes(i);
          const state = feedback ? (i === r.answer ? "bg-mint-500 text-white border-mint-500" : i === picked ? "bg-gray-200 border-gray-300" : "opacity-50") : "";
          return (
            <button key={i} disabled={!!feedback || gone} onClick={() => { setPicked(i); onAnswer(i); }}
              className={`min-h-[80px] rounded-3xl border-4 border-brand-200 bg-brand-50 px-4 text-3xl font-black transition active:scale-95 ${gone ? "invisible" : ""} ${state}`}>
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrderRound({ r, feedback, hintWord, onAnswer }: { r: Extract<Round, { kind: "order" }>; feedback: Feedback; hintWord: string | null; onAnswer: (ok: boolean) => void }) {
  const [chosen, setChosen] = useState<number[]>([]);
  useEffect(() => {
    if (hintWord && !chosen.length) {
      const i = r.words.indexOf(hintWord);
      if (i >= 0) setChosen([i]);
    }
  }, [hintWord, chosen.length, r.words]);
  useEffect(() => {
    if (chosen.length === r.words.length && !feedback) {
      const sentence = normalizeAr(chosen.map((i) => r.words[i]).join(" "));
      onAnswer(r.orders.some((o) => normalizeAr(o.join(" ")) === sentence));
    }
  }, [chosen, r, feedback, onAnswer]);
  return (
    <div>
      <p className="text-lg text-gray-500">{r.prompt}</p>
      <div className="my-5 flex min-h-[84px] flex-wrap items-center justify-center gap-2 rounded-3xl border-4 border-dashed border-sky-300 bg-sky-50 p-3">
        <span className="text-4xl">🚂</span>
        {chosen.map((i, k) => <button key={k} disabled={!!feedback} onClick={() => setChosen(chosen.filter((_, j) => j !== k))} className="rounded-2xl bg-sky-500 px-4 py-3 text-2xl font-bold text-white shadow">{r.words[i]}</button>)}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {r.words.map((w, i) => !chosen.includes(i) && <button key={i} disabled={!!feedback} onClick={() => setChosen([...chosen, i])} className="rounded-2xl border-4 border-sky-200 bg-white px-5 py-3 text-2xl font-bold shadow active:scale-95">{w}</button>)}
      </div>
    </div>
  );
}

function TypeRound({ r, feedback, hintLetter, onAnswer }: { r: Extract<Round, { kind: "type" }>; feedback: Feedback; hintLetter: string | null; onAnswer: (ok: boolean) => void }) {
  const [v, setV] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onAnswer(normalizeAr(v, "spelling") === normalizeAr(r.answer, "spelling")); }}>
      <p className="text-lg text-gray-500">{r.prompt}</p>
      <button type="button" className="my-4 rounded-full bg-emerald-500 p-6 text-6xl text-white shadow-lg active:scale-95" onClick={() => say(r.say, 0.7)} aria-label="استمعي للكلمة">🔊</button>
      {hintLetter && <p className="mb-2 text-lg text-amber-700">تبدأ الكلمة بحرف «{hintLetter}»</p>}
      <input className="input mx-auto block max-w-sm py-4 text-center text-4xl" value={v} onChange={(e) => setV(e.target.value)} disabled={!!feedback} autoFocus autoComplete="off" spellCheck={false} aria-label="اكتبي الكلمة" />
      <button className="mt-4 rounded-2xl bg-brand-600 px-8 py-3 text-2xl font-black text-white disabled:opacity-40" disabled={!!feedback || !v.trim()}>تحقّقي ✔️</button>
    </form>
  );
}

function MemoryRound({ r, seed, onPair, onDone }: { r: Extract<Round, { kind: "memory" }>; seed: number; onPair: (ok: boolean, ref: string) => void; onDone: () => void }) {
  const cards = useMemo(() => shuffle(r.pairs.flatMap((p, i) => [{ pair: i, text: p.a }, { pair: i, text: p.b }]), mulberry32(seed)), [r.pairs, seed]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const lock = useRef(false);
  function flip(i: number) {
    if (lock.current || open.includes(i) || matched.includes(cards[i].pair)) return;
    sfx.flip();
    const o = [...open, i];
    setOpen(o);
    if (o.length === 2) {
      lock.current = true;
      const ok = cards[o[0]].pair === cards[o[1]].pair;
      onPair(ok, r.pairs[cards[o[0]].pair].ref);
      setTimeout(() => {
        if (ok) {
          const m = [...matched, cards[o[0]].pair];
          setMatched(m);
          if (m.length === r.pairs.length) onDone();
        }
        setOpen([]);
        lock.current = false;
      }, ok ? 500 : 1100);
    }
  }
  return (
    <div>
      <p className="mb-4 text-lg text-gray-500">{r.prompt} ({matched.length}/{r.pairs.length})</p>
      <div className={`grid gap-3 ${cards.length > 8 ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4"}`}>
        {cards.map((c, i) => {
          const shown = open.includes(i) || matched.includes(c.pair);
          return (
            <button key={i} onClick={() => flip(i)} aria-label={shown ? c.text : "بطاقة مقلوبة"}
              className={`flex aspect-[4/3] items-center justify-center rounded-2xl text-2xl font-black shadow transition ${matched.includes(c.pair) ? "bg-mint-100 text-mint-700" : shown ? "bg-white ring-4 ring-violet-300" : "bg-gradient-to-br from-violet-400 to-violet-600 text-white"}`}>
              {shown ? c.text : "❓"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
