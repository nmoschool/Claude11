import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { gradebook } from "@/lib/gradebookService";
import { classLabel } from "@/lib/classes";
import { decryptOptional } from "@/lib/crypto";
import { toCsv, type Cell } from "@/lib/csv";
import { buildXlsx } from "@/lib/spreadsheet";

/**
 * تصدير سجل الدرجات:
 * - csv / xlsx: كشف كامل (كل تقييم + المكوّنات + المجموع + التقدير)
 * - noor: درجات المكوّنات فقط بترتيب الأعمدة لتسهيل نقلها إلى «نور»
 *   (يتضمن رقم الهوية لمن يملك صلاحية البيانات الحساسة).
 */
export const GET = withPermission<{ id: string }>("grades:export", async (req, ctx, { id }) => {
  const url = new URL(req.url);
  const termId = url.searchParams.get("term");
  const format = url.searchParams.get("format") ?? "csv";
  if (!termId) throw new HttpError(400, "TERM_REQUIRED", "حدّدي الفصل الدراسي");
  if (!["csv", "xlsx", "noor"].includes(format)) throw new HttpError(400, "INVALID_FORMAT", "صيغة غير مدعومة");

  const g = await gradebook(ctx, id, termId);
  const comps = g.scheme.components;
  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n);
  let headers: string[];
  let rows: Cell[][];

  if (format === "noor") {
    const withId = ctx.can("students:sensitive", id);
    const ids = withId
      ? new Map((await prisma.student.findMany({ where: { classId: id }, select: { id: true, nationalIdEnc: true } })).map((s) => [s.id, decryptOptional(s.nationalIdEnc)]))
      : null;
    headers = ["م", ...(withId ? ["رقم الهوية"] : []), "اسم الطالبة", ...comps.map((c) => `${c.title} (${c.weight})`), "المجموع (100)", "التقدير"];
    rows = g.rows.map((r, i) => [
      i + 1,
      ...(ids ? [ids.get(r.student.id) ?? ""] : []),
      r.student.fullName,
      ...comps.map((c) => fmt(r.result.components[c.id])),
      fmt(r.result.total),
      r.result.grade ?? "",
    ]);
  } else {
    const cell = (r: (typeof g.rows)[number], itemId: string): Cell => {
      const c = r.cells[itemId];
      if (!c) return "";
      return c.status === "ABSENT" ? "غ" : c.status === "EXCUSED" ? "ع" : fmt(c.score);
    };
    headers = [
      "م",
      "اسم الطالبة",
      ...g.items.map((it) => `${it.title} (/${it.maxScore})`),
      ...comps.map((c) => `${c.title} (/${c.weight})`),
      "المجموع (100)",
      "التقدير",
      "اكتمال الرصد ٪",
    ];
    rows = g.rows.map((r, i) => [
      i + 1,
      r.student.fullName,
      ...g.items.map((it) => cell(r, it.id)),
      ...comps.map((c) => fmt(r.result.components[c.id])),
      fmt(r.result.total),
      r.result.grade ?? "",
      r.result.completeness,
    ]);
    rows.push([], ["", "المتوسط ٪", ...g.items.map((it) => fmt(g.itemStats[it.id].mean)), ...comps.map((c) => fmt(g.componentStats[c.id].mean)), fmt(g.totalStats.mean)]);
  }

  const label = classLabel(g.class);
  const base = `درجات-لغتي-${label.replace(/\s*\/\s*/g, "-")}-${g.term.title}${format === "noor" ? "-نور" : ""}`;
  await audit({ actorId: ctx.id, action: "GRADES_EXPORTED", entity: "SchoolClass", entityId: id, after: { termId, format } });

  if (format === "xlsx") {
    const buf = await buildXlsx({ name: "الدرجات", headers, rows: rows.map((r) => r.map((c) => (c === undefined ? null : c))) as (string | number | null)[][] });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(base + ".xlsx")}`,
      },
    });
  }
  return new Response(toCsv([headers, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(base + ".csv")}`,
    },
  });
});
