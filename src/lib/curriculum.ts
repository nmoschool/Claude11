import { latinDigits, looseAr } from "@/lib/text";

/** ثوابت ومنطق نقي لتوزيع المنهج (آمن للمتصفح) */

export const LESSON_KINDS = {
  READING: "نص قرائي",
  LISTENING: "نص الاستماع",
  LEXICAL: "الصنف اللغوي",
  GRAMMAR: "الوظيفة النحوية",
  SPELLING: "الرسم الإملائي",
  HANDWRITING: "الرسم الكتابي",
  WRITING: "التواصل الكتابي",
  SPEAKING: "التواصل الشفهي",
  REVIEW: "مراجعة وتقويم",
} as const;
export type LessonKindName = keyof typeof LESSON_KINDS;

export const LESSON_STATUS = { PLANNED: "مخطط", DONE: "منفّذ", POSTPONED: "مؤجّل" } as const;

export const EVENT_TYPES = {
  LESSON: { label: "درس", color: "bg-brand-100 text-brand-800" },
  HOMEWORK: { label: "واجب", color: "bg-mint-50 text-mint-700" },
  QUIZ: { label: "اختبار قصير", color: "bg-amber-100 text-amber-800" },
  MIDTERM: { label: "اختبار فتري", color: "bg-orange-100 text-orange-800" },
  FINAL: { label: "اختبار نهائي", color: "bg-red-100 text-red-800" },
  ACTIVITY: { label: "نشاط", color: "bg-accent-100 text-accent-800" },
} as const;
export type EventTypeName = keyof typeof EVENT_TYPES;

export function kindFromLabel(raw: string): LessonKindName | null {
  const s = looseAr(raw);
  if (!s) return null;
  for (const [k, label] of Object.entries(LESSON_KINDS)) {
    if (looseAr(label) === s || k.toLowerCase() === s) return k as LessonKindName;
  }
  const hints: [string, LessonKindName][] = [
    ["قراء", "READING"], ["استماع", "LISTENING"], ["صنف", "LEXICAL"], ["نحو", "GRAMMAR"],
    ["املاء", "SPELLING"], ["خط", "HANDWRITING"], ["كتاب", "HANDWRITING"], ["تعبير", "WRITING"],
    ["كتابي", "WRITING"], ["شفه", "SPEAKING"], ["مراجع", "REVIEW"], ["تقويم", "REVIEW"],
  ];
  // «التواصل الكتابي» يجب ألا يُطابق «الرسم الكتابي»
  if (s.includes("تواصل") && s.includes("كتاب")) return "WRITING";
  for (const [h, k] of hints) if (s.includes(looseAr(h))) return k;
  return null;
}

export const PLAN_COLUMNS = ["الأسبوع", "الوحدة", "الدرس", "المكوّن", "عدد الحصص", "الأهداف", "رموز المهارات"];

export interface PlanRow {
  row: number;
  week: number | null;
  unit: string;
  title: string;
  kind: LessonKindName | null;
  periods: number;
  objectives: string[];
  skillCodes: string[];
  errors: string[];
}

export function validatePlanRows(rows: Record<string, string>[], weekCount: number, knownSkills: Set<string>): PlanRow[] {
  const col = (r: Record<string, string>, name: string) => {
    const k = Object.keys(r).find((h) => looseAr(h).includes(looseAr(name)));
    return k ? (r[k] ?? "").trim() : "";
  };
  let lastUnit = "";
  return rows.map((r, i) => {
    const errors: string[] = [];
    const weekRaw = latinDigits(col(r, "الأسبوع")).replace(/\D/g, "");
    const week = weekRaw ? Number(weekRaw) : null;
    if (week === null) errors.push("رقم الأسبوع مفقود");
    else if (week < 1 || week > weekCount) errors.push(`رقم الأسبوع خارج النطاق (1–${weekCount})`);
    const unit = col(r, "الوحدة") || lastUnit; // دعم الخلايا المدمجة: الفراغ يعني نفس الوحدة
    if (!unit) errors.push("اسم الوحدة مفقود");
    lastUnit = unit;
    const title = col(r, "الدرس");
    if (!title) errors.push("عنوان الدرس مفقود");
    const kindRaw = col(r, "المكون");
    const kind = kindFromLabel(kindRaw) ?? (kindRaw ? null : "READING");
    if (!kind) errors.push(`المكوّن غير معروف: «${kindRaw}»`);
    const periods = Number(latinDigits(col(r, "الحصص")).replace(/\D/g, "")) || 1;
    const skillCodes = col(r, "المهارات").split(/[,،\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    const unknown = skillCodes.filter((c) => !knownSkills.has(c));
    if (unknown.length) errors.push(`رموز مهارات غير معروفة: ${unknown.join("، ")}`);
    const objectives = col(r, "الأهداف").split(/[\n؛;]+/).map((s) => s.trim()).filter(Boolean);
    return { row: i + 2, week, unit, title, kind, periods, objectives, skillCodes, errors };
  });
}
