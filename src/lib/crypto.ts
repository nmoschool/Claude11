import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * تشفير الحقول الحساسة على مستوى التطبيق (AES-256-GCM).
 * الصيغة المخزنة: v1:<iv base64>:<tag base64>:<ciphertext base64>
 * المفتاح: FIELD_ENCRYPTION_KEY = 32 بايت بترميز base64
 *   توليده: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

function key(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error("FIELD_ENCRYPTION_KEY غير مضبوط");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY يجب أن يكون 32 بايت (base64)");
  return k;
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptField(stored: string): string {
  const [v, iv, tag, data] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("صيغة حقل مشفّر غير صالحة");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString(
    "utf8"
  );
}

export function encryptOptional(v: string | null | undefined): string | null {
  return v ? encryptField(v) : null;
}

export function decryptOptional(v: string | null | undefined): string | null {
  return v ? decryptField(v) : null;
}

/** إقناع رقم الهوية للعرض: 1•••••••89 */
export function maskId(last4: string | null | undefined): string {
  if (!last4) return "—";
  return `${last4.slice(0, 1)}•••••••${last4.slice(-2)}`;
}
