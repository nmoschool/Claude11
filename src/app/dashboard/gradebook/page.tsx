import Link from "next/link";
import { prisma } from "@/lib/prisma";
import GradebookDetail from "@/components/GradebookDetail";

export default async function GradebookPage({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string }>;
}) {
  const params = await searchParams;
  const assignments = await prisma.assignment.findMany({
    orderBy: { assignedAt: "desc" },
    include: {
      class: true,
      worksheet: { select: { title: true, type: true } },
      submissions: { select: { status: true } },
    },
  });

  const selectedId = params.assignment ?? assignments[0]?.id;

  const selected = selectedId
    ? await prisma.assignment.findUnique({
        where: { id: selectedId },
        include: {
          class: true,
          worksheet: { include: { questions: { orderBy: { order: "asc" } } } },
          submissions: {
            include: { student: true, answers: true },
            orderBy: { student: { fullName: "asc" } },
          },
        },
      })
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">دفتر الدرجات والتصحيح</h1>
        <p className="text-sm text-gray-500">
          تصحيح تلقائي للأسئلة الموضوعية، وتصحيح يدوي للمسائل الحسابية المفتوحة
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        {assignments.map((a) => {
          const gradedCount = a.submissions.filter((s) =>
            ["AUTO_GRADED", "MANUAL_GRADED", "REVIEWED"].includes(s.status)
          ).length;
          return (
            <Link
              key={a.id}
              href={`/dashboard/gradebook?assignment=${a.id}`}
              className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                a.id === selectedId
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {a.class.name} — {a.worksheet.title}{" "}
              <span className="text-xs text-gray-400">
                ({gradedCount}/{a.submissions.length})
              </span>
            </Link>
          );
        })}
        {assignments.length === 0 && (
          <p className="text-sm text-gray-400">
            لا توجد تكليفات بعد. قم بتكليف فصل من صفحة أوراق العمل أولاً.
          </p>
        )}
      </div>

      {selected && (
        <GradebookDetail
          worksheetTitle={`${selected.class.name} — ${selected.worksheet.title}`}
          questions={selected.worksheet.questions as any}
          submissions={selected.submissions as any}
        />
      )}
    </div>
  );
}
