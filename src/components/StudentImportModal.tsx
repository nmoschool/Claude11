"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { buildRows, guessFieldMapping, StudentRow, ValidatedRow } from "@/lib/excelImport";

const FIELD_LABELS: Record<keyof StudentRow, string> = {
  fullName: "الاسم",
  studentNumber: "رقم الطالب",
  grade: "الصف",
  className: "الفصل/الشعبة",
  guardianPhone: "جوال ولي الأمر",
};

export default function StudentImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<keyof StudentRow, string | null>>({
    fullName: null,
    studentNumber: null,
    grade: null,
    className: null,
    guardianPhone: null,
  });
  const [defaultGrade, setDefaultGrade] = useState(1);
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: any[] } | null>(null);

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (json.length === 0) {
      alert("الملف فارغ أو غير مقروء");
      return;
    }

    const detectedHeaders = Object.keys(json[0]);
    setHeaders(detectedHeaders);
    setRawData(json);
    setMapping(guessFieldMapping(detectedHeaders));
    setStep("map");
  }

  function proceedToPreview() {
    setRows(buildRows(rawData, mapping, defaultGrade));
    setStep("preview");
  }

  async function confirmImport() {
    const validRows = rows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;
    setSubmitting(true);
    const res = await fetch("/api/students/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: validRows }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      setStep("done");
      router.refresh();
    } else {
      alert("تعذر استيراد الطلاب");
    }
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl2 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-900">استيراد طلاب من Excel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              ارفع ملف Excel (.xlsx أو .csv) يحتوي على أعمدة: الاسم، الرقم، الصف، الفصل.
              سيحاول النظام مطابقة الأعمدة تلقائياً ويمكنك تعديل المطابقة يدوياً.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="input"
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              حدد أي عمود من الملف يقابل كل حقل مطلوب. تم اكتشاف {rawData.length} صفاً.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(Object.keys(FIELD_LABELS) as (keyof StudentRow)[]).map((field) => (
                <div key={field}>
                  <label className="label">
                    {FIELD_LABELS[field]}
                    {field !== "guardianPhone" && <span className="text-red-500"> *</span>}
                  </label>
                  <select
                    className="input"
                    value={mapping[field] ?? ""}
                    onChange={(e) =>
                      setMapping({ ...mapping, [field]: e.target.value || null })
                    }
                  >
                    <option value="">— بدون —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <label className="label">الصف الافتراضي (إن لم يوجد عمود للصف)</label>
                <select
                  className="input"
                  value={defaultGrade}
                  onChange={(e) => setDefaultGrade(Number(e.target.value))}
                >
                  <option value={1}>الأول الابتدائي</option>
                  <option value={2}>الثاني الابتدائي</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between">
              <button className="btn-secondary" onClick={() => setStep("upload")}>
                رجوع
              </button>
              <button
                className="btn-primary"
                disabled={!mapping.fullName || !mapping.studentNumber || !mapping.className}
                onClick={proceedToPreview}
              >
                معاينة البيانات ←
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-3 text-sm">
              <span className="badge bg-brand-50 text-brand-700">صالحة: {validCount}</span>
              {invalidCount > 0 && (
                <span className="badge bg-red-50 text-red-700">بها أخطاء: {invalidCount}</span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="p-2 text-right">#</th>
                    <th className="p-2 text-right">الاسم</th>
                    <th className="p-2 text-right">الرقم</th>
                    <th className="p-2 text-right">الصف</th>
                    <th className="p-2 text-right">الفصل</th>
                    <th className="p-2 text-right">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.rowIndex} className={r.errors.length ? "bg-red-50" : ""}>
                      <td className="p-2">{r.rowIndex}</td>
                      <td className="p-2 font-bold">{r.fullName || "—"}</td>
                      <td className="p-2" dir="ltr">{r.studentNumber || "—"}</td>
                      <td className="p-2">{r.grade === 1 ? "الأول" : "الثاني"}</td>
                      <td className="p-2">{r.className || "—"}</td>
                      <td className="p-2 text-red-600">{r.errors.join("، ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <button className="btn-secondary" onClick={() => setStep("map")}>
                رجوع
              </button>
              <button
                className="btn-primary"
                disabled={validCount === 0 || submitting}
                onClick={confirmImport}
              >
                {submitting ? "جارِ الاستيراد..." : `استيراد ${validCount} طالباً`}
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4 text-center">
            <div className="text-4xl">✅</div>
            <p className="font-bold text-gray-900">
              تم استيراد {result.created} طالباً بنجاح
            </p>
            {result.skipped.length > 0 && (
              <p className="text-sm text-red-600">
                تم تجاوز {result.skipped.length} صفاً (أرقام مكررة موجودة مسبقاً)
              </p>
            )}
            <button className="btn-primary" onClick={onClose}>
              إغلاق
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
