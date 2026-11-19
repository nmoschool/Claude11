import { prisma } from "@/lib/prisma";
import { formatHijri } from "@/lib/dates";

/** ترويسة رسمية للتقارير المطبوعة */
export default async function ReportHeader({ schoolId, title, subtitle }: { schoolId: string; title: string; subtitle?: string }) {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  return (
    <header className="mb-5 border-b-2 border-brand-600 pb-3">
      <div className="flex items-start justify-between text-xs leading-relaxed text-gray-700">
        <div>
          <div className="font-bold">المملكة العربية السعودية</div>
          <div>وزارة التعليم</div>
          <div>{school.region}</div>
          <div>{school.name}</div>
        </div>
        <div className="text-left">
          <div>المادة: لغتي — الصف الرابع</div>
          <div>تاريخ الإصدار: {formatHijri(new Date())}</div>
        </div>
      </div>
      <h1 className="mt-3 text-center text-xl font-black">{title}</h1>
      {subtitle && <p className="text-center text-sm text-gray-600">{subtitle}</p>}
    </header>
  );
}
