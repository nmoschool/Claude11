import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/guard";
import { certificateView } from "@/lib/certificate";
import CertificateView from "@/components/CertificateView";
import PrintButton from "@/components/PrintButton";

export default async function MyCertificate({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStudentPage();
  const { id } = await params;
  if (!(await prisma.certificate.findFirst({ where: { id, studentId: s.id } }))) notFound();
  const c = await certificateView(id);
  return (
    <div className="min-h-screen bg-gray-100 p-4 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-[1000px] justify-between">
        <Link href="/student/certificates" className="rounded-2xl bg-white px-4 py-2 font-bold shadow">→ شهاداتي</Link>
        <PrintButton />
      </div>
      <CertificateView c={c} />
    </div>
  );
}
