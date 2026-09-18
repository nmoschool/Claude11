import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WorksheetsPage() {
  const session = await getServerSession(authOptions);

  const worksheets = await prisma.worksheet.findMany({
    where: session?.user.role === "TEACHER" ? { createdById: session.user.id } : {},
    orderBy: { createdAt: "desc" },
    include: {
      unit: { select: { title: true } },
      _count: { select: { questions: true, assignments: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">أوراق العمل والاختبارات</h1>
          <p className="text-sm text-gray-500">إدارة أوراق العمل والاختبارات القصيرة الخاصة بك</p>
        </div>
        <Link href="/dashboard/worksheets/new" className="btn-primary">
          ＋ ورقة/اختبار جديد
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-3 text-right font-bold">العنوان</th>
              <th className="p-3 text-right font-bold">النوع</th>
              <th className="p-3 text-right font-bold">الصف</th>
              <th className="p-3 text-right font-bold">الوحدة</th>
              <th className="p-3 text-right font-bold">الأسئلة</th>
              <th className="p-3 text-right font-bold">التكليفات</th>
              <th className="p-3 text-right font-bold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {worksheets.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="p-3 font-bold text-gray-900">{w.title}</td>
                <td className="p-3">
                  <span
                    className={`badge ${
                      w.type === "QUIZ" ? "bg-accent-50 text-accent-700" : "bg-brand-50 text-brand-700"
                    }`}
                  >
                    {w.type === "QUIZ" ? "اختبار قصير" : "ورقة عمل"}
                  </span>
                </td>
                <td className="p-3 text-gray-600">{w.grade === 1 ? "الأول" : "الثاني"}</td>
                <td className="p-3 text-gray-600">{w.unit?.title ?? "—"}</td>
                <td className="p-3 text-gray-600">{w._count.questions}</td>
                <td className="p-3 text-gray-600">{w._count.assignments}</td>
                <td className="p-3">
                  <Link href={`/dashboard/worksheets/${w.id}`} className="font-bold text-brand-700 hover:underline">
                    فتح ←
                  </Link>
                </td>
              </tr>
            ))}
            {worksheets.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  لا توجد أوراق عمل بعد. ابدأ بإنشاء ورقة جديدة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
