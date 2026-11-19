/**
 * تطبيع النص العربي قبل المقارنة — جوهر التصحيح الآلي العادل (docs القسم 5.1).
 *
 * وضعان:
 * - spelling (الإملاء): تبقى الهمزات والتاء المربوطة والألف المقصورة كما هي لأنها المهارة المقاسة.
 * - lenient (النحو/الفهم/الصرف): تُوحَّد الهمزات والتاء والألف المقصورة حتى لا تُعاقَب
 *   الطالبة على خطأ إملائي في سؤال لا يقيس الإملاء.
 * في الوضعين: يُزال التشكيل والتطويل وعلامات الترقيم وتُوحَّد المسافات والأرقام.
 */

export type NormalizeMode = "spelling" | "lenient";

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const PUNCT = /[.,،؛;:!?؟"'«»()\[\]{}\-–—_/\\…]/g;

export function normalizeAr(input: string, mode: NormalizeMode = "lenient"): string {
  let t = (input ?? "")
    .normalize("NFC")
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (mode === "lenient") {
    t = t
      .replace(/[أإآٱ]/g, "ا")
      .replace(/[ؤئ]/g, "ء")
      .replace(/ة(?=\s|$)/g, "ه")
      .replace(/ى(?=\s|$)/g, "ي");
  }
  return t.toLowerCase();
}

/** هل الإجابة مطابقة لإحدى الإجابات المقبولة؟ */
export function matchesAny(answer: string, accepted: string[], mode: NormalizeMode): boolean {
  const a = normalizeAr(answer, mode);
  if (!a) return false;
  return accepted.some((x) => normalizeAr(x, mode) === a);
}
