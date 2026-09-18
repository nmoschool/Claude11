import { prisma } from "@/lib/prisma";
import AdminClient from "@/components/AdminClient";

export default async function AdminPage() {
  const [settingRow, users, auditLogs] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "branding" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, active: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const branding = settingRow
    ? JSON.parse(settingRow.value)
    : {
        siteName: "منصة رياضيات 1448",
        schoolName: "مدرستي الابتدائية",
        primaryColor: "#158756",
        accentColor: "#f2760c",
        logoUrl: "",
        hijriYear: "1448",
      };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">لوحة الإدارة</h1>
        <p className="text-sm text-gray-500">
          التحكم بالنصوص والألوان والصلاحيات وإدارة المستخدمين
        </p>
      </div>
      <AdminClient
        branding={branding}
        users={users as any}
        auditLogs={JSON.parse(JSON.stringify(auditLogs))}
      />
    </div>
  );
}
