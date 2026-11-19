import { latinDigits, looseAr } from "@/lib/text";

/** استيراد الطالبات من ملف «نور» أو أي جدول — مطابقة أعمدة + تحقق (منطق نقي) */

export const IMPORT_FIELDS = {
  fullName: { label: "اسم الطالبة", required: true, keys: ["اسم الطالب", "اسم الطالبة", "الاسم", "name"] },
  nationalId: { label: "رقم الهوية", required: false, keys: ["رقم الهوية", "السجل المدني", "الهوية", "الاقامة", "national"] },
  birthDate: { label: "تاريخ الميلاد", required: false, keys: ["تاريخ الميلاد", "الميلاد", "birth"] },
  guardianName: { label: "اسم ولي الأمر", required: false, keys: ["ولي الامر", "اسم ولي", "guardian"] },
  guardianPhone: { label: "جوال ولي الأمر", required: false, keys: ["جوال", "الجوال", "هاتف", "phone", "mobile"] },
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;
export type Mapping = Partial<Record<ImportField, string>>;

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<string>();
  // الترتيب مهم: الجوال أولاً (فلا يلتقط «اسم ولي الأمر» عمود «جوال ولي الأمر»)،
  // ثم اسم ولي الأمر قبل اسم الطالبة (فلا يلتقط «الاسم» عمود ولي الأمر)
  const order: ImportField[] = ["guardianPhone", "guardianName", "nationalId", "birthDate", "fullName"];
  for (const f of order) {
    const keys = IMPORT_FIELDS[f].keys.map(looseAr);
    const h = headers.find((h) => !used.has(h) && keys.some((k) => looseAr(h).includes(k)));
    if (h) {
      m[f] = h;
      used.add(h);
    }
  }
  return m;
}

export interface CleanStudent {
  fullName: string;
  displayName: string;
  nationalId: string | null;
  birthDate: string | null; // YYYY-MM-DD
  guardianName: string | null;
  guardianPhone: string | null;
}

export interface ValidatedRow {
  row: number; // رقم الصف في الملف (للعرض)
  data: CleanStudent;
  errors: string[];
  warnings: string[];
}

export function normalizePhone(raw: string): string | null {
  let p = latinDigits(raw).replace(/[\s\-()]/g, "");
  if (p.startsWith("+966")) p = "0" + p.slice(4);
  else if (p.startsWith("00966")) p = "0" + p.slice(5);
  else if (p.startsWith("966")) p = "0" + p.slice(3);
  else if (/^5\d{8}$/.test(p)) p = "0" + p;
  return /^05\d{8}$/.test(p) ? p : null;
}

export function normalizeNationalId(raw: string): string | null {
  const id = latinDigits(raw).replace(/\D/g, "");
  return /^[12]\d{9}$/.test(id) ? id : null;
}

export function normalizeDate(raw: string): string | null {
  const s = latinDigits(raw).trim();
  let y: number, mo: number, d: number;
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else return null;
  if (y < 1900) return null; // تاريخ هجري: غير مدعوم في الاستيراد حالياً
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function validateRows(rows: Record<string, string>[], mapping: Mapping): ValidatedRow[] {
  const get = (r: Record<string, string>, f: ImportField) => (mapping[f] ? (r[mapping[f]!] ?? "").trim() : "");
  const seen = new Map<string, number>();

  return rows.map((r, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fullName = get(r, "fullName").replace(/\s+/g, " ");
    if (!fullName) errors.push("الاسم فارغ");
    else if (fullName.split(" ").length < 2) warnings.push("الاسم قصير (يُفضّل الاسم الثلاثي أو الرباعي)");

    const rawId = get(r, "nationalId");
    const nationalId = rawId ? normalizeNationalId(rawId) : null;
    if (rawId && !nationalId) errors.push("رقم الهوية يجب أن يكون 10 أرقام يبدأ بـ 1 أو 2");
    if (nationalId) {
      if (seen.has(nationalId)) errors.push(`رقم الهوية مكرر مع الصف ${seen.get(nationalId)}`);
      else seen.set(nationalId, i + 2);
    }

    const rawPhone = get(r, "guardianPhone");
    const guardianPhone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !guardianPhone) warnings.push("رقم الجوال غير صالح وسيُتجاهل");

    const rawBirth = get(r, "birthDate");
    const birthDate = rawBirth ? normalizeDate(rawBirth) : null;
    if (rawBirth && !birthDate) warnings.push("تاريخ الميلاد غير مفهوم (يُقبل الميلادي فقط) وسيُتجاهل");

    return {
      row: i + 2,
      data: {
        fullName,
        displayName: fullName.split(" ")[0] ?? "",
        nationalId,
        birthDate,
        guardianName: get(r, "guardianName") || null,
        guardianPhone,
      },
      errors,
      warnings,
    };
  });
}
