"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GAMES, GAME_CODES, type GameCode } from "@/lib/games";
import { flush, loadPack, queue, refreshPack } from "@/lib/offlineStore";

export default function GamesHub({ studentId, name }: { studentId: string; name: string }) {
  const [enabled, setEnabled] = useState<GameCode[] | null>(null);
  const [stats, setStats] = useState<Record<string, { played: number; accuracy: number | null }>>({});
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const cached = loadPack(studentId);
    if (cached) setEnabled(cached.enabled);
    setPending(queue(studentId).length);
    refreshPack(studentId).then((p) => p && setEnabled(p.enabled));
    flush(studentId).then(() => setPending(queue(studentId).length));
    fetch("/api/v1/me/games").then((r) => (r.ok ? r.json() : null)).then((d) => d && setStats(Object.fromEntries(d.games.map((g: any) => [g.code, g])))).catch(() => {});
    const on = () => { setOnline(true); flush(studentId).then(() => setPending(queue(studentId).length)); };
    const off = () => setOnline(false);
    addEventListener("online", on);
    addEventListener("offline", off);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); };
  }, [studentId]);

  const list = (enabled ?? GAME_CODES).filter((g) => g in GAMES);
  return (
    <div className="min-h-screen bg-gradient-to-b from-accent-50 via-brand-50 to-mint-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-brand-800">🎮 ألعابي يا {name}</h1>
          <div className="flex gap-2">
            <Link href="/student/progress" className="rounded-2xl bg-white px-4 py-2 font-bold shadow">⭐ نقاطي</Link>
            <Link href="/student" className="rounded-2xl bg-white px-4 py-2 font-bold shadow">→ الرئيسية</Link>
          </div>
        </div>
        {(!online || pending > 0) && (
          <div className="rounded-2xl bg-white/80 p-3 text-center text-sm">
            {!online ? "📶 أنتِ دون اتصال — يمكنك اللعب وستُحفظ نقاطك عند عودة الاتصال" : `⏳ ${pending} إجابة بانتظار المزامنة`}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => {
            const G = GAMES[g];
            const st = stats[g];
            return (
              <Link key={g} href={`/student/games/${g}`} className={`flex min-h-[180px] flex-col justify-between rounded-3xl bg-gradient-to-br ${G.color} p-5 text-white shadow-lg transition hover:scale-105`}>
                <span className="text-6xl">{G.icon}</span>
                <div>
                  <div className="text-2xl font-black">{G.title}</div>
                  <div className="text-sm opacity-90">{G.desc}</div>
                  {st?.played ? <div className="mt-1 text-xs opacity-90">لعبتِ {st.played} مرة · دقتك {st.accuracy}٪</div> : null}
                </div>
              </Link>
            );
          })}
        </div>
        {enabled && !enabled.length && <p className="rounded-3xl bg-white p-10 text-center text-xl text-gray-500 shadow">لا توجد ألعاب مفعّلة الآن 🌈</p>}
      </div>
    </div>
  );
}
