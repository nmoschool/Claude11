import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, assertScope, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { readUpload } from "@/lib/upload";
import { readSpreadsheet } from "@/lib/spreadsheet";
import { guessMapping, validateRows, IMPORT_FIELDS, type Mapping } from "@/lib/studentImport";
import { encryptOptional, hashNationalId, maskId } from "@/lib/crypto";
import { AVATARS } from "@/lib/pictures";
import { parseDay } from "@/lib/dates";

const MappingSchema = z.record(z.enum(Object.keys(IMPORT_FIELDS) as [keyof typeof IMPORT_FIELDS]), z.string()).optional();

/**
 * استيراد الطالبات (ملف «نور» أو أي Excel/CSV).
 * الحقول: file، mapping (JSON اختياري — وإلا تُخمَّن)، dryRun=1 للمعاينة.
 * المطابقة برقم الهوية: الموجودة في نفس الفصل تُحدَّث بياناتها الفارغة، والمسجّلة في فصل آخر تُتخطّى.
 */
export const POST = withPermission<{ id: string }>("students:write", async (req, ctx, { id }) => {
  assertScope(ctx, id);
  if (!ctx.can("students:sensitive", id)) {
    throw new HttpError(403, "FORBIDDEN", "الاستيراد يتضمن بيانات حساسة ويتطلب صلاحية البيانات الحساسة");
  }
  const { form, file, buf } = await readUpload(req, 5 * 1024 * 1024);
  let sheet;
  try {
    sheet = await readSpreadsheet(buf, file.name);
  } catch (e) {
    throw new HttpError(400, "BAD_FILE", (e as Error).message);
  }
  if (!sheet.rows.length) throw new HttpError(400, "EMPTY", "لم نجد صفوفاً في الملف");

  const rawMapping = form.get("mapping");
  const mapping: Mapping = rawMapping ? MappingSchema.parse(JSON.parse(String(rawMapping))) ?? {} : guessMapping(sheet.headers);
  if (!mapping.fullName) throw new HttpError(400, "NO_NAME_COLUMN", "حدّدي عمود اسم الطالبة");
  const rows = validateRows(sheet.rows, mapping);

  // تصنيف كل صف: جديد / تحديث / تعارض
  const hashes = rows.filter((r) => r.data.nationalId).map((r) => hashNationalId(r.data.nationalId!));
  const existing = await prisma.student.findMany({ where: { nationalIdHash: { in: hashes } }, include: { class: true } });
  const byHash = new Map(existing.map((s) => [s.nationalIdHash!, s]));
  const names = new Set(
    (await prisma.student.findMany({ where: { classId: id, archived: false }, select: { fullName: true } })).map((s) => s.fullName)
  );

  const plan = rows.map((r) => {
    if (r.errors.length) return { ...r, action: "error" as const };
    const ex = r.data.nationalId ? byHash.get(hashNationalId(r.data.nationalId)) : undefined;
    if (ex && ex.classId !== id) return { ...r, action: "conflict" as const, errors: [`مسجّلة في فصل آخر (${ex.class.section})`] };
    if (ex) return { ...r, action: "update" as const, existingId: ex.id };
    if (names.has(r.data.fullName)) return { ...r, action: "skip" as const, warnings: [...r.warnings, "يوجد اسم مطابق في الفصل — تُخطّيت"] };
    return { ...r, action: "create" as const };
  });
  const counts = plan.reduce((m, r) => ({ ...m, [r.action]: (m[r.action] ?? 0) + 1 }), {} as Record<string, number>);

  // المعاينة تعرض الهوية مقنّعة فقط
  const preview = plan.map((r) => ({
    row: r.row,
    action: r.action,
    errors: r.errors,
    warnings: r.warnings,
    fullName: r.data.fullName,
    nationalId: r.data.nationalId ? maskId(r.data.nationalId.slice(-4)) : null,
    guardianPhone: r.data.guardianPhone,
    birthDate: r.data.birthDate,
  }));
  if (form.get("dryRun") === "1") return { headers: sheet.headers, mapping, counts, rows: preview, applied: false };

  let n = await prisma.student.count({ where: { classId: id } });
  await prisma.$transaction(
    async (tx) => {
      for (const r of plan) {
        const d = r.data;
        if (r.action === "create") {
          await tx.student.create({
            data: {
              classId: id,
              fullName: d.fullName,
              displayName: d.displayName,
              avatar: AVATARS[n++ % AVATARS.length],
              birthDate: d.birthDate ? parseDay(d.birthDate) : null,
              guardianName: d.guardianName,
              nationalIdEnc: encryptOptional(d.nationalId),
              nationalIdLast4: d.nationalId?.slice(-4) ?? null,
              nationalIdHash: d.nationalId ? hashNationalId(d.nationalId) : null,
              guardianPhoneEnc: encryptOptional(d.guardianPhone),
            },
          });
        } else if (r.action === "update") {
          const ex = existing.find((e) => e.id === r.existingId)!;
          await tx.student.update({
            where: { id: ex.id },
            data: {
              fullName: d.fullName,
              archived: false,
              ...(!ex.birthDate && d.birthDate ? { birthDate: parseDay(d.birthDate) } : {}),
              ...(!ex.guardianName && d.guardianName ? { guardianName: d.guardianName } : {}),
              ...(!ex.guardianPhoneEnc && d.guardianPhone ? { guardianPhoneEnc: encryptOptional(d.guardianPhone) } : {}),
            },
          });
        }
      }
    },
    { timeout: 60_000 }
  );
  await audit({ actorId: ctx.id, action: "STUDENTS_IMPORTED", entity: "SchoolClass", entityId: id, after: { file: file.name, counts } });
  return { headers: sheet.headers, mapping, counts, rows: preview, applied: true };
});
