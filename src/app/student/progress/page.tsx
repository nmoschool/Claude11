import { requireStudentPage } from "@/lib/guard";
import { progress } from "@/lib/gameService";
import Link from "next/link";
import { formatHijri } from "@/lib/dates";

export default async function ProgressPage() {
  const s = await requireStudentPage();
  const p = await progress(s);
  const L = p.level;
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-brand-50 to-mint-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-brand-800">⭐ نقاطي وأوسمتي</h1>
          <div className="flex gap-2">
            <Link href="/student/games" className="rounded-2xl bg-white px-4 py-2 font-bold shadow">🎮 الألعاب</Link>
            <Link href="/student" className="rounded-2xl bg-white px-4 py-2 font-bold shadow">→ الرئيسية</Link>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-6 text-center shadow">
          <div className="text-7xl">{L.icon}</div>
          <div className="mt-2 text-3xl font-black">{L.title}</div>
          <div className="mt-1 text-xl text-gray-600">{p.points} نقطة</div>
          {L.next && (
            <div className="mx-auto mt-4 max-w-md">
              <div className="h-4 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="التقدم نحو المستوى التالي" aria-valuenow={L.progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-accent-500" style={{ width: `${L.progress}%` }} /></div>
              <p className="mt-1 text-sm text-gray-500">بقي {L.next.min - p.points} نقطة لتصبحي {L.next.icon} {L.next.title}</p>
            </div>
          )}
          <div className="mt-4 flex justify-center gap-3 text-2xl">{p.levels.map((l, i) => <span key={l.code} className={i <= L.index ? "" : "opacity-25 grayscale"} title={`${l.title} (${l.min})`}>{l.icon}</span>)}</div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow">
          <h2 className="mb-3 text-2xl font-black">🎖️ أوسمتي</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {p.badges.map((b) => (
              <div key={b.code} className={`rounded-2xl border-2 p-3 text-center ${b.earnedAt ? "border-amber-300 bg-amber-50" : "border-dashed border-gray-200 bg-gray-50"}`}>
                <div className={`text-4xl ${b.earnedAt ? "" : "grayscale"}`}>{b.earnedAt ? b.icon : "🔒"}</div>
                <div className="font-black">{b.title}</div>
                <div className="text-xs text-gray-500">{b.desc}</div>
                {b.earnedAt && <div className="mt-1 text-[11px] text-amber-700">{formatHijri(b.earnedAt)}</div>}
              </div>
            ))}
          </div>
        </section>

        {p.leaderboard && (
          <section className="rounded-3xl bg-white p-6 shadow">
            <h2 className="mb-3 text-2xl font-black">🏆 لوحة الشرف</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 font-bold text-gray-500">الأعلى نقاطاً</h3>
                <ol className="space-y-1">{p.leaderboard.top.map((x, i) => <li key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${x.me ? "bg-brand-100 font-black" : "bg-gray-50"}`}><span className="w-6">{["🥇", "🥈", "🥉", "4", "5"][i]}</span><span className="text-xl">{x.avatar}</span><span className="flex-1">{x.name}</span><span>{x.points}</span></li>)}</ol>
              </div>
              <div>
                <h3 className="mb-2 font-bold text-gray-500">الأكثر تقدماً هذا الأسبوع</h3>
                <ol className="space-y-1">{p.leaderboard.mostImproved.map((x, i) => <li key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${x.me ? "bg-mint-100 font-black" : "bg-gray-50"}`}><span className="text-xl">{x.avatar}</span><span className="flex-1">{x.name}</span><span>+{x.week}</span></li>)}</ol>
                {!p.leaderboard.mostImproved.length && <p className="text-gray-400">العبي هذا الأسبوع لتظهري هنا 🌱</p>}
              </div>
            </div>
          </section>
        )}
        <Link href="/student/certificates" className="block rounded-3xl bg-white p-5 text-center text-xl font-black shadow">📜 شهاداتي ({p.certificates.length})</Link>
      </div>
    </div>
  );
}
