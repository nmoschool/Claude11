/** فحص إعدادات البيئة قبل النشر: npm run check:env (يعيد رمز خروج 1 عند وجود أخطاء) */
import { checkEnv } from "../src/lib/env";

const issues = checkEnv({ ...process.env, NODE_ENV: process.env.NODE_ENV ?? "production" });
if (!issues.length) console.log("✅ إعدادات البيئة سليمة");
for (const i of issues) console.log(`${i.level === "error" ? "✖" : "⚠"} ${i.key}: ${i.message}`);
process.exit(issues.some((i) => i.level === "error") ? 1 : 0);
