import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WorksheetPrintView from "@/components/WorksheetPrintView";
import WorksheetActions from "@/components/WorksheetActions";

async function getBranding() {
  const setting = await prisma.setting.findUnique({ where: { key: "branding" } });
  return setting ? JSON.parse(setting.value) : { schoolName: "مدرستي الابتدائية", hijriYear: "1448" };
}

export default async function WorksheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [worksheet, classes, branding] = await Promise.all([
    prisma.worksheet.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: "asc" } },
        unit: { select: { title: true } },
        assignments: {
          include: {
            class: true,
            submissions: { select: { status: true } },
          },
        },
      },
    }),
    prisma.schoolClass.findMany({ orderBy: { name: "asc" } }),
    getBranding(),
  ]);

  if (!worksheet) notFound();

  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link href="/dashboard/worksheets" className="text-sm font-bold text-gray-500 hover:text-gray-800">
          → العودة لقائمة الأوراق
        </Link>
      </div>

      <WorksheetActions
        worksheetId={worksheet.id}
        classes={classes.filter((c) => c.grade === worksheet.grade)}
      />

      {worksheet.assignments.length > 0 && (
        <div className="no-print card p-5">
          <h3 className="mb-3 font-bold text-gray-900">التكليفات الحالية</h3>
          <div className="space-y-2">
            {worksheet.assignments.map((a) => {
              const graded = a.submissions.filter((s) =>
                ["AUTO_GRADED", "MANUAL_GRADED", "REVIEWED"].includes(s.status)
              ).length;
              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-bold">{a.class.name}</span>
                  <span className="text-gray-500">
                    {graded} / {a.submissions.length} تم تصحيحها
                  </span>
                  <Link href={`/dashboard/gradebook?assignment=${a.id}`} className="font-bold text-brand-700 hover:underline">
                    فتح دفتر الدرجات ←
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <WorksheetPrintView
        title={worksheet.title}
        type={worksheet.type as "WORKSHEET" | "QUIZ"}
        grade={worksheet.grade}
        durationMinutes={worksheet.durationMinutes}
        instructions={worksheet.instructions}
        unitTitle={worksheet.unit?.title}
        questions={worksheet.questions}
        schoolName={branding.schoolName}
        hijriYear={branding.hijriYear}
      />
    </div>
  );
}
