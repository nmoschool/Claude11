import { randomInt } from "crypto";
import { PICTURES, CODE_LENGTH } from "@/lib/pictures";

export { PICTURES, CODE_LENGTH, AVATARS } from "@/lib/pictures";

/**
 * رمز الدخول الصوري للطالبات: تسلسل من 4 صور تُختار من شبكة 9 صور.
 * 9^4 = 6561 احتمالاً + قفل بعد 5 محاولات خاطئة لمدة 10 دقائق ⇒ تخمين غير عملي.
 */

export const STUDENT_MAX_FAILS = 5;
export const STUDENT_LOCK_MINUTES = 10;

export function randomPictureCode(): number[] {
  return Array.from({ length: CODE_LENGTH }, () => randomInt(PICTURES.length));
}

export function serializeCode(code: number[]): string {
  return code.join("-");
}

export function parseCode(raw: string): number[] | null {
  const parts = raw.split("-").map(Number);
  if (
    parts.length !== CODE_LENGTH ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n >= PICTURES.length)
  ) {
    return null;
  }
  return parts;
}

export function codeToEmojis(code: number[]): string {
  return code.map((i) => PICTURES[i].emoji).join(" ");
}

export function codeToLabels(code: number[]): string {
  return code.map((i) => PICTURES[i].label).join(" ← ");
}

/** رمز فصل قصير سهل الكتابة (بدون أحرف ملتبسة مثل O/0 و I/1) */
export function randomJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join("");
}

