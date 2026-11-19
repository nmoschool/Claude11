import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * تخزين ملفات الطالبات.
 * - local (افتراضي للتطوير/VPS): مجلد FILE_STORAGE_DIR خارج public — لا يُخدم إلا عبر API بعد التحقق.
 * - s3: أي خدمة متوافقة مع S3 (bucket خاص) — روابط تنزيل موقّعة تنتهي بعد 10 دقائق.
 *   مطلوب في بيئات serverless (Netlify/Vercel) لأنها بلا قرص دائم.
 */

export interface Stored {
  key: string;
}

interface Driver {
  put(key: string, body: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  signedUrl?(key: string, fileName: string, mime: string): Promise<string>;
}

const driverName = () => process.env.FILE_STORAGE_DRIVER ?? "local";

function localDriver(): Driver {
  const root = path.resolve(process.env.FILE_STORAGE_DIR ?? ".data/uploads");
  const resolve = (key: string) => {
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error("مسار غير صالح");
    return p;
  };
  return {
    async put(key, body) {
      const p = resolve(key);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, body, { mode: 0o600 });
    },
    get: (key) => fs.readFile(resolve(key)),
    async remove(key) {
      await fs.rm(resolve(key), { force: true });
    },
  };
}

let s3Cache: Driver | null = null;
async function s3Driver(): Promise<Driver> {
  if (s3Cache) return s3Cache;
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const Bucket = process.env.S3_BUCKET;
  if (!Bucket) throw new Error("S3_BUCKET غير مضبوط");
  const client = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: process.env.S3_ACCESS_KEY_ID
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" }
      : undefined,
  });
  s3Cache = {
    async put(Key, Body, ContentType) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType, ServerSideEncryption: "AES256" }));
    },
    async get(Key) {
      const r = await client.send(new GetObjectCommand({ Bucket, Key }));
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async remove(Key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
    },
    signedUrl: (Key, fileName, mime) =>
      getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket,
          Key,
          ResponseContentType: mime,
          ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        }),
        { expiresIn: 600 }
      ),
  };
  return s3Cache;
}

const driver = () => (driverName() === "s3" ? s3Driver() : Promise.resolve(localDriver()));

export async function storeFile(prefix: string, ext: string, body: Buffer, mime: string): Promise<Stored> {
  const key = `${prefix}/${new Date().getUTCFullYear()}/${randomUUID()}.${ext}`;
  await (await driver()).put(key, body, mime);
  return { key };
}

export async function readFile(key: string) {
  return (await driver()).get(key);
}

export async function deleteFile(key: string) {
  return (await driver()).remove(key);
}

/** رابط مباشر موقّت (S3) أو null للتخزين المحلي (يُخدم الملف عبر الـ API) */
export async function signedDownloadUrl(key: string, fileName: string, mime: string) {
  const d = await driver();
  return d.signedUrl ? d.signedUrl(key, fileName, mime) : null;
}
