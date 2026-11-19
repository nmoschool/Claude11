/**
 * رسوم SVG تُرسم على الخادم (تعمل في الصفحة وفي PDF) — لون واحد (بنفسجي المنصة).
 * كل علامة لها <title> (تلميح عند المرور)، وكل رسم مرفق بجدول بالأرقام في الصفحة.
 */
import { SUPPORT_THRESHOLD } from "@/lib/gradeCalc";

const INK = "#374151";
const MUTED = "#6b7280";
const GRID = "#e5e7eb";
const BAR = "#7440e6"; // brand-600
const BAR_SOFT = "#c4b2fe"; // brand-300 (المقارنة بمتوسط الفصل)

/**
 * أشرطة أفقية لنسب مئوية 0–100 (من اليمين لليسار كبقية الواجهة)،
 * مع خط عتبة الدعم وعلامة اختيارية لمتوسط الفصل
 */
export function PercentBars({ data, title, height = 26 }: { data: { label: string; value: number | null; compare?: number | null }[]; title: string; height?: number }) {
  const rows = data.filter((d) => d.value !== null);
  const W = 640, LBL = 210, PAD = 46, plotW = W - LBL - PAD;
  const H = rows.length * height + 30;
  const x0 = W - LBL; // بداية المحور (يمين منطقة الرسم)
  const x = (v: number) => x0 - (v / 100) * plotW;
  return (
    <figure className="break-inside-avoid">
      {/* اتجاه صريح RTL: text-anchor="start" = الحافة اليمنى للنص عند x */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} direction="rtl" style={{ direction: "rtl" }}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={4} y2={H - 22} stroke={GRID} strokeWidth={1} />
            <text x={x(t)} y={H - 8} fontSize={11} fill={MUTED} textAnchor="middle">{t}٪</text>
          </g>
        ))}
        <line x1={x(SUPPORT_THRESHOLD)} x2={x(SUPPORT_THRESHOLD)} y1={4} y2={H - 22} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 3" />
        {rows.map((d, i) => {
          const y = 8 + i * height;
          const bh = Math.max(10, height - 12);
          const w = Math.max(2, x0 - x(d.value!));
          return (
            <g key={d.label}>
              <text x={W - 4} y={y + bh / 2 + 4} fontSize={12} fill={INK} textAnchor="start">{d.label}</text>
              <rect x={x0 - w} y={y} width={w} height={bh} rx={4} fill={BAR}>
                <title>{`${d.label}: ${d.value}٪${d.compare != null ? ` (متوسط الفصل ${d.compare}٪)` : ""}`}</title>
              </rect>
              {d.compare != null && <rect x={x(d.compare) - 1.5} y={y - 2} width={3} height={bh + 4} rx={1.5} fill={INK}><title>{`متوسط الفصل: ${d.compare}٪`}</title></rect>}
              <text x={x(d.value!) - 6} y={y + bh / 2 + 4} fontSize={11} fill={INK} fontWeight={700} textAnchor="start">{d.value}٪</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-[11px] text-gray-500">
        الخط الأحمر المتقطع = حد الدعم ({SUPPORT_THRESHOLD}٪){data.some((d) => d.compare != null) && " · العلامة الداكنة = متوسط الفصل"}
      </figcaption>
    </figure>
  );
}

/** أعمدة لتوزيع التقديرات (عدد الطالبات لكل تقدير) */
export function DistributionBars({ data, title }: { data: { label: string; count: number }[]; title: string }) {
  const W = 520, H = 190, B = 30, T = 18;
  const max = Math.max(1, ...data.map((d) => d.count));
  const slot = (W - 20) / data.length;
  const bw = Math.min(56, slot - 18);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} direction="rtl" style={{ direction: "rtl" }}>
      <line x1={10} x2={W - 10} y1={H - B} y2={H - B} stroke={GRID} />
      {data.map((d, i) => {
        const h = ((H - B - T) * d.count) / max;
        const cx = W - 10 - slot * i - slot / 2; // من اليمين لليسار (ممتاز أولاً)
        return (
          <g key={d.label}>
            <rect x={cx - bw / 2} y={H - B - h} width={bw} height={Math.max(h, d.count ? 2 : 0)} rx={4} fill={BAR}>
              <title>{`${d.label}: ${d.count} طالبة`}</title>
            </rect>
            <text x={cx} y={H - B - h - 5} fontSize={12} fontWeight={700} fill={INK} textAnchor="middle">{d.count}</text>
            <text x={cx} y={H - 10} fontSize={11} fill={MUTED} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// تدرّج لون واحد فاتح ← داكن (أعلى إتقان = أدكن)
const STEPS = [
  { min: 90, bg: "#5029a3", fg: "#ffffff" },
  { min: 80, bg: "#6230c9", fg: "#ffffff" },
  { min: 70, bg: "#8b5cf6", fg: "#ffffff" },
  { min: 60, bg: "#c4b2fe", fg: "#1f2937" },
  { min: 50, bg: "#ddd3ff", fg: "#1f2937" },
  { min: 0, bg: "#f6f3ff", fg: "#1f2937" },
];
export const heatColor = (v: number) => STEPS.find((s) => v >= s.min)!;

/** خريطة حرارية: الطالبات × المهارات (HTML ليتسع للأسماء العربية الطويلة) */
export function SkillHeatmap({ students, skills, values }: { students: { id: string; fullName: string }[]; skills: { id: string; title: string }[]; values: Record<string, Record<string, number>> }) {
  if (!skills.length) return <p className="text-sm text-gray-400">لا توجد تقييمات موسومة بمهارات بعد.</p>;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate text-[11px]" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="text-right font-bold text-gray-500">الطالبة</th>
              {skills.map((s) => <th key={s.id} className="max-w-[5.5rem] px-1 text-center font-bold leading-tight text-gray-600">{s.title}</th>)}
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id}>
                <td className="whitespace-nowrap pl-2 text-gray-800">{st.fullName}</td>
                {skills.map((sk) => {
                  const v = values[st.id]?.[sk.id];
                  if (v === undefined) return <td key={sk.id} className="rounded bg-gray-50 text-center text-gray-300">—</td>;
                  const c = heatColor(v);
                  return <td key={sk.id} className="rounded text-center font-bold" style={{ background: c.bg, color: c.fg }} title={`${st.fullName} — ${sk.title}: ${v}٪`}>{Math.round(v)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-500">
        <span>الإتقان ٪:</span>
        {[...STEPS].reverse().map((s, i, arr) => (
          <span key={s.min} className="flex items-center gap-1">
            <span className="inline-block h-3 w-6 rounded" style={{ background: s.bg }} />
            {s.min}{i < arr.length - 1 ? `–${arr[i + 1].min}` : "+"}
          </span>
        ))}
      </div>
    </div>
  );
}
