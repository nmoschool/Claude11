import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/guard";
import { formatHijri } from "@/lib/dates";

export default async function MyCertificates() {
  const s = await requireStudentPage();
  const certs = await prisma.certificate.findMany({ where: { studentId: s.id }, orderBy: { issuedAt: "desc" } });
  return (
    <div className="min-h-screen bg-gradient-to-b from-accent-50 via-brand-50 to-mint-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-brand-800">🏅 شهاداتي</h1>
          <Link href="/student" className="rounded-2xl bg-white px-4 py-2 font-bold shadow">→ الرئيسية</Link>
        </div>
        {certs.map((c) => (
          <Link key={c.id} href={`/student/certificates/${c.id}`} className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow transition hover:scale-[1.01]">
            <span className="text-5xl">📜</span>
            <div className="flex-1"><div className="text-xl font-black">{c.title}</div><div className="text-gray-500">{formatHijri(c.issuedAt)}</div></div>
            <span className="text-brand-700">عرض ←</span>
          </Link>
        ))}
        {!certs.length && <p className="rounded-3xl bg-white p-10 text-center text-xl text-gray-500 shadow">العبي واجمعي النقاط لتحصلي على أول شهادة 🌟</p>}
      </div>
    </div>
  );
}
