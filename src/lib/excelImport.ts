export interface StudentRow {
  fullName: string;
  studentNumber: string;
  grade: number;
  className: string;
  guardianPhone?: string;
}

export interface ValidatedRow extends StudentRow {
  rowIndex: number;
  errors: string[];
}

const FIELD_KEYWORDS: Record<keyof StudentRow, string[]> = {
  fullName: ["اسم", "الاسم", "name", "الطالب"],
  studentNumber: ["رقم", "الرقم", "number", "id", "السجل", "هوية"],
  grade: ["صف", "الصف", "grade"],
  className: ["فصل", "الفصل", "شعبة", "class", "section"],
  guardianPhone: ["جوال", "هاتف", "phone", "ولي"],
};

/** يحاول تخمين تطابق أعمدة ملف Excel مع الحقول المطلوبة بناءً على أسماء الأعمدة */
export function guessFieldMapping(headers: string[]): Record<keyof StudentRow, string | null> {
  const mapping = {} as Record<keyof StudentRow, string | null>;

  (Object.keys(FIELD_KEYWORDS) as (keyof StudentRow)[]).forEach((field) => {
    const keywords = FIELD_KEYWORDS[field];
    const match = headers.find((h) =>
      keywords.some((k) => h.toString().trim().toLowerCase().includes(k.toLowerCase()))
    );
    mapping[field] = match ?? null;
  });

  return mapping;
}

function normalizeDigits(value: string): string {
  // تحويل الأرقام العربية-الهندية إلى أرقام لاتينية
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return value.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

export function buildRows(
  data: Record<string, any>[],
  mapping: Record<keyof StudentRow, string | null>,
  defaultGrade: number
): ValidatedRow[] {
  const seenNumbers = new Set<string>();

  return data.map((raw, index) => {
    const errors: string[] = [];

    const fullName = mapping.fullName ? String(raw[mapping.fullName] ?? "").trim() : "";
    let studentNumber = mapping.studentNumber
      ? normalizeDigits(String(raw[mapping.studentNumber] ?? "").trim())
      : "";
    const gradeRaw = mapping.grade ? String(raw[mapping.grade] ?? "").trim() : "";
    const className = mapping.className
      ? String(raw[mapping.className] ?? "").trim()
      : "";
    const guardianPhone = mapping.guardianPhone
      ? normalizeDigits(String(raw[mapping.guardianPhone] ?? "").trim())
      : undefined;

    if (!fullName) errors.push("الاسم مفقود");
    if (!studentNumber) errors.push("رقم الطالب مفقود");
    if (studentNumber && seenNumbers.has(studentNumber)) {
      errors.push("رقم مكرر داخل الملف");
    }
    if (studentNumber) seenNumbers.add(studentNumber);

    let grade = defaultGrade;
    if (gradeRaw) {
      const parsedGrade = parseInt(normalizeDigits(gradeRaw).replace(/[^\d]/g, ""), 10);
      if (parsedGrade === 1 || parsedGrade === 2) grade = parsedGrade;
      else if (gradeRaw.includes("أول")) grade = 1;
      else if (gradeRaw.includes("ثاني")) grade = 2;
    }

    if (!className) errors.push("اسم الفصل/الشعبة مفقود");

    return {
      rowIndex: index + 2, // +2: مراعاة صف العناوين وبداية العد من 1
      fullName,
      studentNumber,
      grade,
      className,
      guardianPhone: guardianPhone || undefined,
      errors,
    };
  });
}
