/**
 * التحفيز (نقي) — docs القسم 6.3
 * - إجابة صحيحة = 10، بلا تلميح = +5، كل 5 صحيحة متتالية = +20. لا خصم أبداً.
 * - تُحسب النقاط على الخادم من سجل المحاولات (لا يُوثق برقم يرسله الجهاز).
 * - سقف يومي لمنع الاستنزاف، وتجاهل الإجابات الأسرع من المعقول.
 */

export const POINTS = { correct: 10, noHint: 5, streakEvery: 5, streakBonus: 20 } as const;
export const DAILY_CAP = 1500;
export const MIN_MS = 200;

export const LEVELS = [
  { code: "BUD", title: "برعم", icon: "🌱", min: 0 },
  { code: "FLOWER", title: "زهرة", icon: "🌸", min: 200 },
  { code: "STAR", title: "نجمة", icon: "⭐", min: 600 },
  { code: "MOON", title: "قمر", icon: "🌙", min: 1200 },
  { code: "SUN", title: "شمس اللغة", icon: "☀️", min: 2000 },
] as const;

export function levelFor(points: number) {
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (points >= l.min) idx = i;
  });
  const next = LEVELS[idx + 1] ?? null;
  return {
    ...LEVELS[idx],
    index: idx,
    next,
    progress: next ? Math.round(((points - LEVELS[idx].min) / (next.min - LEVELS[idx].min)) * 100) : 100,
  };
}

export interface AttemptIn {
  correct: boolean;
  hintsUsed: number;
  ms: number;
}

/** نقاط دفعة محاولات مرتبة زمنياً، مع السلسلة السابقة (streakBefore) واستهلاك اليوم (usedToday) */
export function scoreBatch(attempts: AttemptIn[], streakBefore = 0, usedToday = 0): { points: number[]; streakAfter: number } {
  let streak = streakBefore;
  let used = usedToday;
  const points = attempts.map((a) => {
    if (!a.correct) {
      streak = 0;
      return 0;
    }
    streak++;
    if (a.ms < MIN_MS) return 0;
    let p = POINTS.correct + (a.hintsUsed === 0 ? POINTS.noHint : 0);
    if (streak % POINTS.streakEvery === 0) p += POINTS.streakBonus;
    p = Math.max(0, Math.min(p, DAILY_CAP - used));
    used += p;
    return p;
  });
  return { points, streakAfter: streak };
}

export interface PlayerStats {
  totalAttempts: number;
  correctBySkillPrefix: Record<string, number>; // SPELL / LEX / GRAM / READ
  bestStreak: number;
  consecutiveDays: number; // أطول سلسلة أيام لعب متتالية
  improvedSkills: string[]; // مهارات تحسنت فيها الدقة ≥ 20 نقطة
  gamesPlayed: number; // ألعاب مختلفة
}

export const BADGES = [
  { code: "FIRST_STEP", title: "البداية المشرقة", icon: "🌅", desc: "أول جولة لعب", test: (s: PlayerStats) => s.totalAttempts >= 1 },
  { code: "SPELL_QUEEN", title: "سيدة الإملاء", icon: "✍️", desc: "50 إجابة صحيحة في الرسم الإملائي", test: (s: PlayerStats) => (s.correctBySkillPrefix.SPELL ?? 0) >= 50 },
  { code: "GRAMMAR_FRIEND", title: "صديقة القواعد", icon: "📐", desc: "30 إجابة صحيحة في الصنف والوظيفة النحوية", test: (s: PlayerStats) => (s.correctBySkillPrefix.LEX ?? 0) + (s.correctBySkillPrefix.GRAM ?? 0) >= 30 },
  { code: "PERFECT_TEN", title: "عشرة بلا خطأ", icon: "🎯", desc: "10 إجابات صحيحة متتالية", test: (s: PlayerStats) => s.bestStreak >= 10 },
  { code: "PERSISTENT", title: "قارئة مثابرة", icon: "📆", desc: "اللعب 7 أيام متتالية", test: (s: PlayerStats) => s.consecutiveDays >= 7 },
  { code: "IMPROVER", title: "المتحسّنة", icon: "📈", desc: "تحسّن 20٪ في مهارة", test: (s: PlayerStats) => s.improvedSkills.length > 0 },
  { code: "EXPLORER", title: "المستكشفة", icon: "🧭", desc: "لعب كل الألعاب", test: (s: PlayerStats) => s.gamesPlayed >= 6 },
] as const;
export type BadgeCode = (typeof BADGES)[number]["code"];

export function earnedBadges(s: PlayerStats): BadgeCode[] {
  return BADGES.filter((b) => b.test(s)).map((b) => b.code);
}

/** أطول سلسلة أيام متتالية من قائمة أيام YYYY-MM-DD */
export function longestDayStreak(days: string[]): number {
  const sorted = Array.from(new Set(days)).sort();
  let best = 0;
  let cur = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = Date.parse(`${d}T00:00:00Z`) / 86_400_000;
    cur = prev !== null && t - prev === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}

/** أطول سلسلة إجابات صحيحة متتالية */
export function bestStreak(corrects: boolean[]): number {
  let best = 0;
  let cur = 0;
  for (const c of corrects) {
    cur = c ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

/** مهارات تحسنت: دقة آخر 20 محاولة − دقة أول 20 ≥ 20 نقطة (بحد أدنى 30 محاولة في المهارة) */
export function improvedSkills(bySkill: Record<string, boolean[]>): string[] {
  const acc = (xs: boolean[]) => (xs.filter(Boolean).length / xs.length) * 100;
  return Object.entries(bySkill)
    .filter(([, xs]) => xs.length >= 30 && acc(xs.slice(-20)) - acc(xs.slice(0, 20)) >= 20)
    .map(([k]) => k);
}
