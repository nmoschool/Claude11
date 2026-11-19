/**
 * إنشاء المدرسة ومدير النظام في قاعدة فارغة — مرة واحدة بعد أول نشر.
 *   docker compose exec app node deploy/create-admin.cjs "اسم المدرسة" "الإدارة التعليمية" admin@school.edu.sa "اسم المدير"
 * يرفض العمل إن وُجد أي مستخدم (لا يمكن استخدامه لإضافة مدير خفي لاحقاً).
 * يطبع كلمة مرور مؤقتة؛ يُطلب تفعيل التحقق الثنائي عند أول دخول.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

(async () => {
  const [school, region, email, name = "مدير النظام"] = process.argv.slice(2);
  if (!school || !region || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || "")) {
    console.error('الاستخدام: node deploy/create-admin.cjs "اسم المدرسة" "الإدارة التعليمية" email@school.edu.sa ["اسم المدير"]');
    process.exit(2);
  }
  const p = new PrismaClient();
  try {
    if ((await p.user.count()) > 0) {
      console.error("✖ توجد حسابات في القاعدة مسبقاً — أنشئي المستخدمين الجدد من «المستخدمون والصلاحيات».");
      process.exit(1);
    }
    const s = await p.school.create({ data: { name: school, region } });
    const pw = `${crypto.randomBytes(9).toString("base64url")}-${crypto.randomInt(10, 100)}a`;
    await p.user.create({ data: { schoolId: s.id, name, email: email.toLowerCase(), role: "SUPER_ADMIN", passwordHash: await bcrypt.hash(pw, 12) } });
    console.log(`✅ أُنشئت المدرسة «${school}» وحساب مدير النظام ${email}`);
    console.log(`   كلمة المرور المؤقتة: ${pw}`);
    console.log("   سيُطلب تفعيل التحقق الثنائي عند أول دخول. غيّري كلمة المرور فوراً.");
  } finally {
    await p.$disconnect();
  }
})();
