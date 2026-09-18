import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getStats() {
  const [students, worksheets, classes, gradedSubmissions] = await Promise.all([
    prisma.student.count({ where: { active: true } }),
    prisma.worksheet.count(),
    prisma.schoolClass.count(),
    prisma.submission.findMany({
      where: { status: { in: ["AUTO_GRADED", "MANUAL_GRADED", "REVIEWED"] } },
      select: { totalScore: true, maxScore: true },
    }),
  ]);

  const avg =
    gradedSubmissions.length > 0
      ? (gradedSubmissions.reduce(
          (sum, s) => sum + ((s.totalScore ?? 0) / (s.maxScore || 1)) * 100,
          0
        ) /
          gradedSubmissions.length
        ).toFixed(1)
      : "—";

  return { students, worksheets, classes, avg };
}

export default async function DashboardHome() {
  const session = await getServerSession(authOptions);
  const stats = await getStats();

  const cards = [
    { label: "عدد الطلاب", value: stats.students, icon: "🎒", href: "/dashboard/students", color: "bg-brand-50 text-brand-700" },
    { label: "أوراق العمل/الاختبارات", value: stats.worksheets, icon: "📝", href: "/dashboard/worksheets", color: "bg-accent-50 text-accent-700" },
    { label: "الفصول", value: stats.classes, icon: "🏫", href: "/dashboard/students", color: "bg-blue-50 text-blue-700" },
    { label: "متوسط الأداء العام", value: `${stats.avg}${stats.avg !== "—" ? "%" : ""}`, icon: "📈", href: "/dashboard/reports", color: "bg-purple-50 text-purple-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">لوحة المعلومات</h1>
        <p className="text-sm text-gray-500">
          نظرة عامة سريعة على أداء الفصل والمنصة - الفصل الدراسي الحالي 1448هـ
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card p-5 transition-shadow hover:shadow-md">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-xl ${c.color}`}>
              {c.icon}
            </div>
            <div className="text-2xl font-black text-gray-900">{c.value}</div>
            <div className="text-sm text-gray-500">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold text-gray-900">إجراءات سريعة</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/dashboard/worksheets/new" className="btn-primary justify-start">
              ＋ إنشاء ورقة عمل / اختبار جديد
            </Link>
            <Link href="/dashboard/students" className="btn-secondary justify-start">
              ⭳ استيراد طلاب من Excel
            </Link>
            <Link href="/dashboard/curriculum" className="btn-secondary justify-start">
              🗺️ مراجعة خريطة المنهج
            </Link>
            <Link href="/dashboard/reports" className="btn-secondary justify-start">
              🏆 عرض لوحة الشرف
            </Link>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-bold text-gray-900">حسابك</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">الاسم</dt>
              <dd className="font-bold">{session?.user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">البريد الإلكتروني</dt>
              <dd className="font-bold" dir="ltr">{session?.user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">الدور</dt>
              <dd className="font-bold">{session?.user.role === "ADMIN" ? "مدير النظام" : session?.user.role === "TEACHER" ? "معلم" : "طالب"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
