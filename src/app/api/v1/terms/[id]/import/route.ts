import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadTerm } from "@/lib/planService";
import { readUpload } from "@/lib/upload";
import { readSpreadsheet } from "@/lib/spreadsheet";
import { validatePlanRows } from "@/lib/curriculum";

/**
 * استيراد التوزيع الرسمي من Excel/CSV.
 * الحقول: file, mode = replace | append, dryRun = 1 للمعاينة.
 * replace يحذف وحدات ودروس هذا الفصل الدراسي ثم يعيد إنشاءها.
 */
export const POST = withPermission<{ id: string }>("curriculum:write", async (req, ctx, { id }) => {
  const term = await loadTerm(ctx, id);
  const { form, file, buf } = await readUpload(req, 5 * 1024 * 1024);
  const mode = form.get("mode") === "replace" ? "replace" : "append";
  const dryRun = form.get("dryRun") === "1";

  let sheet;
  try {
    sheet = await readSpreadsheet(buf, file.name);
  } catch (e) {
    throw new HttpError(400, "BAD_FILE", (e as Error).message);
  }
  if (!sheet.rows.length) throw new HttpError(400, "EMPTY", "لم نجد صفوفاً في الملف");

  const skills = await prisma.skill.findMany();
  const rows = validatePlanRows(sheet.rows, term.weeks.length, new Set(skills.map((s) => s.code)));
  const invalid = rows.filter((r) => r.errors.length);
  const summary = {
    headers: sheet.headers,
    total: rows.length,
    valid: rows.length - invalid.length,
    units: Array.from(new Set(rows.map((r) => r.unit).filter(Boolean))),
    rows: rows.slice(0, 300),
  };
  if (dryRun) return { ...summary, applied: false };
  if (invalid.length) throw new HttpError(400, "INVALID_ROWS", `يوجد ${invalid.length} صف بها أخطاء؛ صحّحيها ثم أعيدي الرفع`);

  const weekByNum = new Map(term.weeks.map((w) => [w.number, w.id]));
  const skillByCode = new Map(skills.map((s) => [s.code, s.id]));

  await prisma.$transaction(
    async (tx) => {
      if (mode === "replace") await tx.unit.deleteMany({ where: { termId: id } });
      const existing = await tx.unit.findMany({ where: { termId: id } });
      const unitIds = new Map(existing.map((u) => [u.title, u.id]));
      let unitOrder = existing.reduce((m, u) => Math.max(m, u.order), 0);
      const lessonOrder = new Map<string, number>();
      for (const r of rows) {
        let unitId = unitIds.get(r.unit);
        if (!unitId) {
          unitId = (await tx.unit.create({ data: { termId: id, title: r.unit, order: ++unitOrder } })).id;
          unitIds.set(r.unit, unitId);
        }
        if (!lessonOrder.has(unitId)) {
          const agg = await tx.lesson.aggregate({ where: { unitId }, _max: { order: true } });
          lessonOrder.set(unitId, agg._max.order ?? 0);
        }
        const order = lessonOrder.get(unitId)! + 1;
        lessonOrder.set(unitId, order);
        await tx.lesson.create({
          data: {
            unitId,
            order,
            title: r.title,
            kind: r.kind!,
            periods: r.periods,
            objectives: r.objectives,
            weekId: weekByNum.get(r.week!) ?? null,
            skills: { create: r.skillCodes.map((c) => ({ skillId: skillByCode.get(c)! })) },
          },
        });
      }
    },
    { timeout: 60_000 }
  );
  await audit({ actorId: ctx.id, action: "PLAN_IMPORTED", entity: "Term", entityId: id, after: { mode, rows: rows.length, file: file.name } });
  return { ...summary, applied: true };
});
