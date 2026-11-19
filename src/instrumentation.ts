/** يعمل مرة واحدة عند إقلاع الخادم */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnv } = await import("@/lib/env");
  const issues = checkEnv();
  for (const i of issues) console[i.level === "error" ? "error" : "warn"](`[env] ${i.level === "error" ? "✖" : "⚠"} ${i.key}: ${i.message}`);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length && process.env.NODE_ENV === "production" && process.env.SKIP_ENV_CHECK !== "true") {
    // خروج صريح: خادم يعمل بإعدادات خطرة (أو يعيد أخطاء 500) أسوأ من خادم متوقف
    console.error(`[env] ✖ إعدادات البيئة غير صالحة للإنتاج: ${errors.map((e) => e.key).join("، ")} — توقف الخادم. (للتجربة المحلية فقط: SKIP_ENV_CHECK=true)`);
    process.exit(1);
  }
}
