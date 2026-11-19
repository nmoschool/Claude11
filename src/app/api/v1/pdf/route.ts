import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { renderPdf, PRINT_PATH } from "@/lib/pdf";

/** GET /api/v1/pdf?path=/print/report-card/<id>?term=... — PDF جاهز للطباعة */
export const GET = withPermission(["grades:export", "reports:export"], async (req, ctx) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";
  if (!PRINT_PATH.test(path)) throw new HttpError(400, "INVALID_PATH", "مسار طباعة غير صالح");
  let pdf: Buffer | null;
  try {
    pdf = await renderPdf(path, req.headers.get("cookie") ?? "", { landscape: url.searchParams.get("landscape") === "1" });
  } catch (e) {
    const m = (e as Error).message;
    if (m === "BUSY") throw new HttpError(503, "BUSY", "الخادم يولّد ملفات أخرى، أعيدي المحاولة بعد لحظات");
    if (m === "FORBIDDEN") throw new HttpError(403, "FORBIDDEN", "لا تملكين صلاحية هذا التقرير");
    throw new HttpError(400, "PDF_FAILED", m);
  }
  if (!pdf) throw new HttpError(501, "PDF_UNAVAILABLE", "توليد PDF على الخادم غير مفعّل؛ استخدمي «طباعة» ثم «حفظ كـ PDF»");
  await audit({ actorId: ctx.id, action: "PDF_EXPORTED", entity: "Report", entityId: path.split("?")[0] });
  const name = (url.searchParams.get("name") ?? "تقرير").replace(/[^\p{L}\p{N}_ -]/gu, "").slice(0, 80) || "تقرير";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name + ".pdf")}`,
      "Cache-Control": "private, no-store",
    },
  });
});
