/**
 * CSV عربي يفتح في Excel مباشرة: UTF-8 مع BOM وفواصل أسطر CRLF.
 * حماية من حقن الصيغ (CSV injection): أي نص يبدأ بـ = + - @ أو Tab يُسبق بعلامة '.
 */
export type Cell = string | number | null | undefined;

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
