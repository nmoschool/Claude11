import { HttpError } from "@/lib/guard";
import { MAX_FILE_BYTES } from "@/lib/fileTypes";

/** يستخرج ملفاً واحداً من طلب multipart مع حد الحجم */
export async function readUpload(req: Request, max = MAX_FILE_BYTES) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > max + 64 * 1024) throw new HttpError(413, "TOO_LARGE", `الحد الأقصى ${Math.round(max / 1048576)} ميجابايت`);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "INVALID_FORM", "يجب إرسال الملف بصيغة multipart/form-data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "NO_FILE", "لم يُرفق ملف");
  if (file.size > max) throw new HttpError(413, "TOO_LARGE", `الحد الأقصى ${Math.round(max / 1048576)} ميجابايت`);
  if (file.size === 0) throw new HttpError(400, "EMPTY", "الملف فارغ");
  return { form, file, buf: Buffer.from(await file.arrayBuffer()) };
}
