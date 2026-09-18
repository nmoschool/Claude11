import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeClassAverages, computeHonorBoard, percentOf } from "@/lib/reports";
import HonorBoard from "@/components/HonorBoard";
import { ClassAverageChart, StudentProgressChart } from "@/components/ReportsCharts";
import StudentSelect from "@/components/StudentSelect";
import { letterGrade } from "@/lib/grading";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; student?: string }>;
}) {
  const params = await searchParams;
  const classes = await prisma.schoolClass.findMany({ orderBy: { name: "asc" } });

  const submissions = await prisma.submission.findMany({
    where: {
      status: { in: ["AUTO_GRADED", "MANUAL_GRADED", "REVIEWED"] },
      ...(params.classId ? { assignment: { classId: params.classId } } : {}),
    },
    include: {
      student: true,
      assignment: { include: { class: true, worksheet: { select: { title: true } } } },
    },
    orderBy: { gradedAt: "asc" },
  });

  const honorBoard = computeHonorBoard(submissions as any);
  const classAverages = computeClassAverages(submissions as any);

  const uniqueStudents = Array.from(
    new Map(submissions.map((s) => [s.student.id, s.student])).values()
  ).sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));

  const selectedStudentId = params.student ?? uniqueStudents[0]?.id;
  const studentSubs = submissions.filter((s) => s.student.id === selectedStudentId);
  const studentChartData = studentSubs.map((s) => ({
    name: s.assignment.worksheet.title.slice(0, 14),
    percent: percentOf(s) ?? 0,
  }));

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-bold ${
      active ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">لوحة الشرف والتقارير</h1>
        <p className="text-sm text-gray-500">مؤشرات أداء ديناميكية قابلة للتصفية حسب الفصل</p>
      </div>

      <div className="no-print flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-1">
        <Link href="/dashboard/reports" className={tabClass(!params.classId)}>
          كل الفصول
        </Link>
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/reports?classId=${c.id}`}
            className={tabClass(params.classId === c.id)}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 font-bold text-gray-900">🏆 لوحة الشرف</h2>
        <HonorBoard entries={honorBoard} />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-gray-900">متوسط الأداء حسب الفصل</h2>
          {classAverages.length > 0 ? (
            <ClassAverageChart data={classAverages} />
          ) : (
            <p className="py-10 text-center text-gray-400">لا توجد بيانات كافية بعد</p>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">التقرير الفردي</h2>
            {uniqueStudents.length > 0 && (
              <StudentSelect students={uniqueStudents} selectedId={selectedStudentId} />
            )}
          </div>
          {studentChartData.length > 0 ? (
            <StudentProgressChart data={studentChartData} />
          ) : (
            <p className="py-10 text-center text-gray-400">لا توجد بيانات كافية بعد</p>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-gray-100 p-4 font-bold text-gray-900">
          سجل الدرجات التفصيلي
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-3 text-right font-bold">الطالب</th>
              <th className="p-3 text-right font-bold">الفصل</th>
              <th className="p-3 text-right font-bold">الورقة/الاختبار</th>
              <th className="p-3 text-right font-bold">الدرجة</th>
              <th className="p-3 text-right font-bold">التقدير</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {submissions.slice(-30).reverse().map((s) => {
              const percent = percentOf(s) ?? 0;
              const grade = letterGrade(percent);
              return (
                <tr key={s.id}>
                  <td className="p-3 font-bold text-gray-900">{s.student.fullName}</td>
                  <td className="p-3 text-gray-600">{s.assignment.class.name}</td>
                  <td className="p-3 text-gray-600">{s.assignment.worksheet.title}</td>
                  <td className="p-3 font-bold">{s.totalScore} / {s.maxScore}</td>
                  <td className="p-3">
                    <span className={`badge ${grade.color}`}>{grade.label}</span>
                  </td>
                </tr>
              );
            })}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  لا توجد بيانات مُصححة بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
