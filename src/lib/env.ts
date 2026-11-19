/**
 * التحقق من إعدادات البيئة عند الإقلاع — يرفض تشغيل الإنتاج بإعدادات خطرة.
 * تُستدعى من src/instrumentation.ts قبل استقبال أي طلب.
 */
export interface EnvIssue {
  level: "error" | "warn";
  key: string;
  message: string;
}

export function checkEnv(env: Record<string, string | undefined> = process.env): EnvIssue[] {
  const prod = env.NODE_ENV === "production";
  const issues: EnvIssue[] = [];
  const bad = (key: string, message: string) => issues.push({ level: prod ? "error" : "warn", key, message });

  if (!env.DATABASE_URL) issues.push({ level: "error", key: "DATABASE_URL", message: "غير مضبوط" });

  const secret = env.NEXTAUTH_SECRET ?? "";
  if (secret.length < 32 || /غيّر|change|secret|dev-/i.test(secret)) bad("NEXTAUTH_SECRET", "يجب أن يكون سلسلة عشوائية طويلة (32 حرفاً على الأقل): openssl rand -base64 32");

  const key = env.FIELD_ENCRYPTION_KEY ?? "";
  let keyLen = 0;
  try {
    keyLen = Buffer.from(key, "base64").length;
  } catch {
    keyLen = 0;
  }
  if (keyLen !== 32) issues.push({ level: "error", key: "FIELD_ENCRYPTION_KEY", message: "يجب أن يكون 32 بايت بترميز base64" });
  else if (key === "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=") bad("FIELD_ENCRYPTION_KEY", "هذا مفتاح التطوير المعروف — ولّدي مفتاحاً جديداً للإنتاج");

  if (env.REQUIRE_STAFF_2FA === "false") bad("REQUIRE_STAFF_2FA", "التحقق الثنائي معطّل");

  const url = env.NEXTAUTH_URL ?? "";
  if (prod && !url.startsWith("https://")) bad("NEXTAUTH_URL", "يجب أن يبدأ بـ https:// في الإنتاج");

  if (prod && (env.FILE_STORAGE_DRIVER ?? "local") === "local" && (env.NETLIFY || env.VERCEL)) {
    issues.push({ level: "error", key: "FILE_STORAGE_DRIVER", message: "التخزين المحلي لا يعمل على Netlify/Vercel — استخدمي s3" });
  }
  if (env.FILE_STORAGE_DRIVER === "s3" && !env.S3_BUCKET) issues.push({ level: "error", key: "S3_BUCKET", message: "مطلوب مع FILE_STORAGE_DRIVER=s3" });
  return issues;
}
