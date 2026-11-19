import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/** TOTP وفق RFC 6238 (SHA-1، 6 أرقام، 30 ثانية) — متوافق مع Google/Microsoft Authenticator */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("base32 غير صالح");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = h[h.length - 1] & 0xf;
  const code =
    (((h[offset] & 0x7f) << 24) |
      (h[offset + 1] << 16) |
      (h[offset + 2] << 8) |
      h[offset + 3]) %
    1_000_000;
  return code.toString().padStart(6, "0");
}

export function totp(secret: string, at = Date.now()): string {
  return hotp(secret, Math.floor(at / 30_000));
}

/** يقبل نافذة ±1 خطوة (30 ثانية) لتعويض فرق الساعة */
export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(at / 30_000);
  for (const d of [-1, 0, 1]) {
    const expected = Buffer.from(hotp(secret, step + d));
    if (timingSafeEqual(expected, Buffer.from(c))) return true;
  }
  return false;
}

export function otpauthUri(secret: string, account: string, issuer = "منصة لغتي"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
