import ExcelJS from "exceljs";

/** قراءة جداول Excel/CSV إلى صفوف نصية — على الخادم (exceljs؛ بديل xlsx ذات الثغرات) */

export interface Sheet {
  headers: string[];
  rows: Record<string, string>[];
}

const MAX_ROWS = 2000;

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    return "";
  }
  return String(v).trim();
}

export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const s = text.replace(/^﻿/, "");
  const delim = (s.split("\n")[0].match(/;/g)?.length ?? 0) > (s.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim())) out.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) out.push(row);
  return out.map((r) => r.map((x) => x.trim()));
}

function toSheet(matrix: string[][]): Sheet {
  // أول صف غير فارغ يحتوي ≥ 2 خلايا نصية = صف العناوين (ملفات «نور» قد تبدأ بسطور ترويسة)
  const hi = matrix.findIndex((r) => r.filter((x) => x && !/^\d+$/.test(x)).length >= 2);
  if (hi < 0) return { headers: [], rows: [] };
  const headers = matrix[hi].map((h, i) => h || `عمود ${i + 1}`);
  const rows = matrix.slice(hi + 1, hi + 1 + MAX_ROWS).map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))
  );
  return { headers, rows: rows.filter((r) => Object.values(r).some(Boolean)) };
}

export async function readSpreadsheet(buf: Buffer, fileName: string): Promise<Sheet> {
  if (/\.csv$/i.test(fileName)) return toSheet(parseCsv(buf.toString("utf8")));
  if (buf.subarray(0, 2).toString("latin1") !== "PK") {
    throw new Error("الملف ليس بصيغة xlsx أو csv صالحة (ملفات xls القديمة: احفظيها بصيغة xlsx أولاً)");
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as ExcelJS.CellValue[]).slice(1);
    matrix.push(vals.map(cellText));
  });
  return toSheet(matrix);
}

export interface SheetSpec {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

/** أول ورقة هي التي تُقرأ عند الاستيراد؛ الأوراق الإضافية مرجعية فقط */
export async function buildXlsx(...sheets: SheetSpec[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const sh of sheets) {
    const ws = wb.addWorksheet(sh.name, { views: [{ rightToLeft: true }] });
    ws.addRow(sh.headers).font = { bold: true };
    sh.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => (c.width = 22));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
