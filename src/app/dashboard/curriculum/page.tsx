import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CurriculumUnitCard from "@/components/CurriculumUnitCard";

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; semester?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const grade = Number(params.grade ?? "1") === 2 ? 2 : 1;
  const semesterOrder = Number(params.semester ?? "1") === 2 ? 2 : 1;

  const semester = await prisma.semester.findFirst({
    where: { order: semesterOrder, hijriYear: "1448" },
  });

  const units = semester
    ? await prisma.curriculumUnit.findMany({
        where: { grade, semesterId: semester.id },
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      })
    : [];

  const editable = session?.user.role === "ADMIN" || session?.user.role === "TEACHER";

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
      active ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">خريطة محتوى المنهج - 1448هـ</h1>
        <p className="text-sm text-gray-500">
          مرتبطة بوحدات الصفين الأول والثاني، قابلة للتعديل حسب الخطة الفصلية لمدرستك.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2 rounded-lg border border-gray-200 bg-white p-1">
          <Link href={`?grade=1&semester=${semesterOrder}`} className={tabClass(grade === 1)}>
            الصف الأول
          </Link>
          <Link href={`?grade=2&semester=${semesterOrder}`} className={tabClass(grade === 2)}>
            الصف الثاني
          </Link>
        </div>
        <div className="flex gap-2 rounded-lg border border-gray-200 bg-white p-1">
          <Link href={`?grade=${grade}&semester=1`} className={tabClass(semesterOrder === 1)}>
            الفصل الأول
          </Link>
          <Link href={`?grade=${grade}&semester=2`} className={tabClass(semesterOrder === 2)}>
            الفصل الثاني
          </Link>
        </div>
      </div>

      <div className="rounded-lg bg-accent-50 px-4 py-3 text-sm text-accent-800">
        ⚠️ هذه خريطة أولية قابلة للتخصيص. يُنصح بمراجعتها ومطابقتها مع الخطة الفصلية
        الرسمية الصادرة عن وزارة التعليم قبل الاعتماد، ثم تعديل العناوين والتقسيم
        الزمني عبر زر «تعديل» في كل وحدة.
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {units.map((unit) => (
          <CurriculumUnitCard
            key={unit.id}
            id={unit.id}
            order={unit.order}
            title={unit.title}
            description={unit.description}
            weeksPlan={unit.weeksPlan}
            lessons={unit.lessons}
            editable={editable}
          />
        ))}
        {units.length === 0 && (
          <div className="card col-span-full p-8 text-center text-gray-400">
            لا توجد بيانات لهذا الفصل بعد. نفّذ سكربت التهيئة (seed) لإضافة الخريطة الأولية.
          </div>
        )}
      </div>
    </div>
  );
}
