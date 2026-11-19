import { requireStudentPage } from "@/lib/guard";
import { classLabel } from "@/lib/classes";
import StudentSignOut from "@/components/StudentSignOut";

const TILES = [
  { icon: "🎮", title: "ألعابي", color: "from-brand-400 to-brand-600" },
  { icon: "⭐", title: "نقاطي وأوسمتي", color: "from-amber-300 to-amber-500" },
  { icon: "📒", title: "واجباتي", color: "from-mint-500 to-mint-700" },
  { icon: "🏅", title: "شهاداتي", color: "from-accent-400 to-accent-600" },
];

export default async function StudentHome() {
  const s = await requireStudentPage();
  return (
    <div className="min-h-screen bg-gradient-to-b from-accent-50 via-brand-50 to-mint-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-6xl">{s.avatar}</span>
            <div>
              <h1 className="text-3xl font-black text-brand-800">أهلاً {s.displayName}!</h1>
              <p className="text-gray-500">{classLabel(s.class)} · نقاطي: <b className="text-amber-600">{s.points}</b> ⭐</p>
            </div>
          </div>
          <StudentSignOut />
        </div>
        <div className="grid grid-cols-2 gap-5">
          {TILES.map((t) => (
            <div key={t.title} className={`flex min-h-[160px] flex-col items-center justify-center rounded-3xl bg-gradient-to-br ${t.color} p-6 text-white shadow-lg`}>
              <span className="text-6xl">{t.icon}</span>
              <span className="mt-2 text-2xl font-black">{t.title}</span>
              <span className="mt-1 rounded-full bg-white/25 px-3 py-0.5 text-sm">قريباً</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
