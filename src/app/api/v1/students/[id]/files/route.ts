import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadStudentInScope } from "@/lib/studentService";
import { readUpload } from "@/lib/upload";
import { detectType, sanitizeUpload, safeFileName, FILE_CATEGORIES, type FileCategory } from "@/lib/fileTypes";
import { storeFile } from "@/lib/storage";

export const POST = withPermission<{ id: string }>("files:upload", async (req, ctx, { id }) => {
  const s = await loadStudentInScope(ctx, id);
  const { form, file, buf } = await readUpload(req);
  const category = String(form.get("category") ?? "OTHER") as FileCategory;
  if (!(category in FILE_CATEGORIES)) throw new HttpError(400, "INVALID_CATEGORY", "تصنيف غير صالح");
  if (category === "MEDICAL" && !ctx.can("students:sensitive", s.classId)) {
    throw new HttpError(403, "FORBIDDEN", "رفع التقارير الطبية يتطلب صلاحية البيانات الحساسة");
  }
  const type = detectType(buf);
  if (!type) throw new HttpError(415, "UNSUPPORTED_TYPE", "نوع الملف غير مسموح (PDF، JPG، PNG، MP3، M4A فقط)");

  const clean = sanitizeUpload(buf, type);
  const stored = await storeFile(`students/${s.id}`, type.ext, clean, type.mime);
  const f = await prisma.studentFile.create({
    data: { studentId: id, storageKey: stored.key, fileName: safeFileName(file.name, type.ext), mime: type.mime, size: clean.length, category, uploadedBy: ctx.id },
  });
  await audit({ actorId: ctx.id, action: "FILE_UPLOADED", entity: "Student", entityId: id, after: { fileId: f.id, category, mime: type.mime, size: clean.length } });
  return { id: f.id, fileName: f.fileName, mime: f.mime, size: f.size };
});
