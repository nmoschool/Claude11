/**
 * التحقق من نوع الملف الحقيقي (magic bytes) لا من الامتداد أو رأس المتصفح،
 * وإزالة البيانات الوصفية من الصور (الموقع الجغرافي، الجهاز...) قبل التخزين.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface DetectedType {
  mime: string;
  ext: string;
}

export function detectType(buf: Buffer): DetectedType | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 3).toString("latin1") === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x06) !== 0)) {
    return { mime: "audio/mpeg", ext: "mp3" };
  }
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (["M4A ", "M4B ", "mp42", "isom", "mp41", "3gp4"].includes(brand)) return { mime: "audio/mp4", ext: "m4a" };
  }
  return null;
}

/** JPEG: حذف مقاطع APP1 (EXIF/XMP) وAPP13 (IPTC) والتعليقات */
export function stripJpegMetadata(buf: Buffer): Buffer {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const parts: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf; // بنية غير متوقعة: نعيد الأصل دون مخاطرة بإتلافه
    const marker = buf[i + 1];
    if (marker === 0xda) {
      parts.push(buf.subarray(i)); // بداية بيانات الصورة حتى النهاية
      return Buffer.concat(parts);
    }
    const len = buf.readUInt16BE(i + 2);
    const seg = buf.subarray(i, i + 2 + len);
    if (!(marker === 0xe1 || marker === 0xed || marker === 0xfe)) parts.push(seg);
    i += 2 + len;
  }
  return buf;
}

/** PNG: حذف مقاطع النصوص وEXIF (tEXt, zTXt, iTXt, eXIf, tIME) */
export function stripPngMetadata(buf: Buffer): Buffer {
  const drop = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
  const parts: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString("latin1");
    const chunk = buf.subarray(i, i + 12 + len);
    if (!drop.has(type)) parts.push(chunk);
    i += 12 + len;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

export function sanitizeUpload(buf: Buffer, type: DetectedType): Buffer {
  if (type.mime === "image/jpeg") return stripJpegMetadata(buf);
  if (type.mime === "image/png") return stripPngMetadata(buf);
  return buf;
}

/** اسم ملف آمن للعرض والتنزيل */
export function safeFileName(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 80) || "ملف";
  return `${base}.${ext}`;
}

export const FILE_CATEGORIES = {
  WORK: "عمل الطالبة (تعبير/خط)",
  AUDIO: "تسجيل قراءة جهرية",
  CERTIFICATE: "شهادة",
  MEDICAL: "تقرير طبي (حساس)",
  OTHER: "أخرى",
} as const;
export type FileCategory = keyof typeof FILE_CATEGORIES;
