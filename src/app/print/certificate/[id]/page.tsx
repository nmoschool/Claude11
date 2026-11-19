import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/guard";
import { certificateView } from "@/lib/certificate";
import CertificateView from "@/components/CertificateView";

export const metadata = { title: "شهادة تقدير" };

export default async function PrintCertificate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("students:read");
  const c = await prisma.certificate.findFirst({ where: { id, student: { class: { schoolId: ctx.schoolId } } }, include: { student: true } });
  if (!c || !ctx.inScope(c.student.classId)) notFound();
  return <CertificateView c={await certificateView(id)} />;
}
