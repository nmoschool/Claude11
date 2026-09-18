interface Entry {
  studentId: string;
  fullName: string;
  className: string;
  avgPercent: number;
  count: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function HonorBoard({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return (
      <div className="card p-8 text-center text-gray-400">
        لا توجد درجات مُصححة بعد لعرض لوحة الشرف
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((e, i) => (
        <div
          key={e.studentId}
          className={`card flex items-center gap-3 p-4 ${
            i < 3 ? "border-2 border-accent-300 bg-accent-50/40" : ""
          }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
            {MEDALS[i] ?? `#${i + 1}`}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-black text-gray-900">{e.fullName}</div>
            <div className="text-xs text-gray-500">{e.className}</div>
          </div>
          <div className="text-left">
            <div className="text-lg font-black text-brand-700">{e.avgPercent}%</div>
            <div className="text-xs text-gray-400">{e.count} تقييم</div>
          </div>
        </div>
      ))}
    </div>
  );
}
