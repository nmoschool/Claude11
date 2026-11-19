import { prisma } from "@/lib/prisma";
import { formatHijri } from "@/lib/dates";

export const metadata = { title: "التحقق من شهادة", robots: { index: false } };

/** صفحة عامة: تعرض الحد الأدنى من البيانات (الاسم الأول + أول حرف من اسم العائلة) */
export default async function Verify({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = /^[A-Z0-9]{10}$/.test(code)
    ? await prisma.certificate.findUnique({ where: { verifyCode: code }, include: { student: { include: { class: { include: { school: true } } } } } })
    : null;
  const parts = c?.student.fullName.split(" ") ?? [];
  const shortName = c ? `${parts[0]} ${parts.length > 1 ? parts[parts.length - 1][0] + "." : ""}` : "";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white p-4">
      <div className="card w-full max-w-md p-8 text-center">
        {c ? (
          <>
            <div className="text-6xl">✅</div>
            <h1 className="mt-3 text-2xl font-black text-mint-700">شهادة صحيحة</h1>
            <dl className="mt-5 space-y-2 text-right">
              <div className="flex justify-between"><dt className="text-gray-500">الطالبة</dt><dd className="font-bold">{shortName}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">الشهادة</dt><dd className="font-bold">{c.title}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">المدرسة</dt><dd>{c.student.class.school.name}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">التاريخ</dt><dd>{formatHijri(c.issuedAt)}</dd></div>
            </dl>
          </>
        ) : (
          <>
            <div className="text-6xl">❌</div>
            <h1 className="mt-3 text-2xl font-black text-red-600">لم نجد شهادة بهذا الرمز</h1>
            <p className="mt-2 text-gray-500">تأكدي من الرمز المطبوع على الشهادة.</p>
          </>
        )}
        <p className="mt-6 text-xs text-gray-400">منصة لغتي</p>
      </div>
    </div>
  );
}
