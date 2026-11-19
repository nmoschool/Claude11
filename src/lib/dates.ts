/** تنسيق التواريخ: الهجري (أم القرى) أولاً ثم الميلادي — آمن للمتصفح والخادم */

const hijriFmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const hijriShort = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const gregFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const weekdayFmt = new Intl.DateTimeFormat("ar-SA", { weekday: "long", timeZone: "UTC" });

export const formatHijri = (d: Date | string) => hijriFmt.format(new Date(d));
export const formatHijriShort = (d: Date | string) => hijriShort.format(new Date(d));
export const formatGregorian = (d: Date | string) => gregFmt.format(new Date(d));
export const formatWeekday = (d: Date | string) => weekdayFmt.format(new Date(d));
export const formatBoth = (d: Date | string) => `${formatHijri(d)} (${formatGregorian(d)})`;

/** تاريخ اليوم بصيغة YYYY-MM-DD حسب توقيت الرياض */
export function todayRiyadh(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

/** يحوّل YYYY-MM-DD إلى Date (منتصف الليل UTC) — يُستخدم مع أعمدة @db.Date */
export function parseDay(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("صيغة التاريخ يجب أن تكون YYYY-MM-DD");
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error("تاريخ غير صالح");
  return d;
}

export const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** أيام الدوام في السعودية: الأحد (0) إلى الخميس (4) */
export const isSchoolDay = (d: Date) => d.getUTCDay() <= 4;
