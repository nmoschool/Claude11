import { prisma } from "@/lib/prisma";
import WorksheetForm from "@/components/WorksheetForm";

export default async function NewWorksheetPage() {
  const units = await prisma.curriculumUnit.findMany({
    orderBy: [{ grade: "asc" }, { order: "asc" }],
    select: { id: true, grade: true, title: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">مولد أوراق العمل والاختبارات</h1>
        <p className="text-sm text-gray-500">
          أنشئ ورقة عمل أو اختباراً قصيراً بخيارات أسئلة متعددة، مع إمكانية التوليد
          التلقائي لمسائل الجمع والطرح.
        </p>
      </div>
      <WorksheetForm units={units} />
    </div>
  );
}
