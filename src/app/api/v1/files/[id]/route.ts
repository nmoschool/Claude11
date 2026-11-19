import { prisma } from "@/lib/prisma";
import { withPermission, HttpError, type StaffContext } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { readFile, deleteFile, signedDownloadUrl } from "@/lib/storage";

async function loadFile(ctx: StaffContext, id: string) {
  const f = await prisma.studentFile.findFirst({ where: { id, student: { class: { schoolId: ctx.schoolId } } }, include: { student: true } });
  if (!f || !ctx.inScope(f.student.classId)) throw new HttpError(404, "NOT_FOUND", "الملف غير موجود");
  if (f.category === "MEDICAL" && !ctx.can("students:sensitive", f.student.classId)) throw new HttpError(404, "NOT_FOUND", "الملف غير موجود");
  return f;
}

/** التنزيل عبر الخادم بعد التحقق (أو تحويل لرابط S3 موقّت 10 دقائق) */
export const GET = withPermission<{ id: string }>("students:read", async (req, ctx, { id }) => {
  const f = await loadFile(ctx, id);
  await audit({ actorId: ctx.id, action: "FILE_VIEWED", entity: "Student", entityId: f.studentId, after: { fileId: id } });
  const signed = await signedDownloadUrl(f.storageKey, f.fileName, f.mime);
  if (signed) return Response.redirect(signed, 302);
  const body = await readFile(f.storageKey);
  const inline = new URL(req.url).searchParams.get("inline") === "1" && f.mime !== "application/pdf";
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(body.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
    },
  });
});

export const DELETE = withPermission<{ id: string }>("files:upload", async (_req, ctx, { id }) => {
  const f = await loadFile(ctx, id);
  await prisma.studentFile.delete({ where: { id } });
  await deleteFile(f.storageKey).catch((e) => console.error("storage delete failed", e));
  await audit({ actorId: ctx.id, action: "FILE_DELETED", entity: "Student", entityId: f.studentId, before: { fileName: f.fileName, category: f.category } });
  return { ok: true };
});
