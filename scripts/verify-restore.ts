/** فحوص سلامة النسخة المستعادة: الجداول، الأعداد، الترحيلات، وفك تشفير عينة بالمفتاح المحفوظ */
import { PrismaClient } from "@prisma/client";
import { decryptField } from "../src/lib/crypto";

const [, , file, seconds] = process.argv;
const prisma = new PrismaClient();
(async () => {
  const checks: [string, boolean, string][] = [];
  const counts = {
    المستخدمون: await prisma.user.count(),
    الطالبات: await prisma.student.count(),
    "رصد الدرجات": await prisma.gradeEntry.count(),
    الحضور: await prisma.attendance.count(),
    "سجل التدقيق": await prisma.auditLog.count(),
  };
  checks.push(["حسابات الطاقم موجودة", counts.المستخدمون > 0, String(counts.المستخدمون)]);
  checks.push(["الطالبات موجودات", counts.الطالبات > 0, String(counts.الطالبات)]);
  const mig = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`.catch(() => [{ n: BigInt(0) }]);
  checks.push(["سجل الترحيلات سليم", Number(mig[0].n) > 0, `${mig[0].n} ترحيل`]);
  const sample = await prisma.student.findFirst({ where: { nationalIdEnc: { not: null } } });
  let decrypted = false;
  try {
    decrypted = !!sample && /^[12]\d{9}$/.test(decryptField(sample.nationalIdEnc!));
  } catch {
    decrypted = false;
  }
  checks.push(["فك تشفير الحقول الحساسة بالمفتاح المحفوظ", decrypted || !sample, sample ? (decrypted ? "نجح" : "فشل — تأكدي من FIELD_ENCRYPTION_KEY") : "لا توجد عينة"]);
  const rto = Number(seconds);
  checks.push(["زمن الاستعادة ضمن الهدف (RTO ≤ 4 ساعات)", rto < 4 * 3600, `${rto} ثانية`]);

  console.log(`تقرير اختبار الاستعادة — ${new Date().toISOString()}\nالنسخة: ${file}`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  for (const [name, ok, detail] of checks) console.log(`  ${ok ? "✅" : "✖"} ${name} (${detail})`);
  await prisma.$disconnect();
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
})();
