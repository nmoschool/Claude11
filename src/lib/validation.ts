import { z } from "zod";
import { randomBytes, randomInt } from "crypto";

export const passwordSchema = z
  .string()
  .min(10, "10 أحرف على الأقل")
  .regex(/[A-Za-z]/, "يجب أن تحتوي على حرف إنجليزي")
  .regex(/\d/, "يجب أن تحتوي على رقم");

export function tempPassword(): string {
  // مثال: Lg-7f3k9q2m-41
  return `Lg-${randomBytes(6).toString("base64url")}-${randomInt(10, 100)}`;
}
