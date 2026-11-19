import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

export const verifyUrl = (code: string) => `${(process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}/verify/${code}`;

/** كل ما يلزم لعرض شهادة (مع رمز QR للتحقق) */
export async function certificateView(id: string) {
  const c = await prisma.certificate.findUniqueOrThrow({ where: { id }, include: { student: { include: { class: { include: { school: true } } } } } });
  const issuer = c.issuedBy !== "system" ? await prisma.user.findUnique({ where: { id: c.issuedBy }, select: { name: true } }) : null;
  const teacher = issuer?.name ?? (await prisma.classStaff.findFirst({ where: { classId: c.student.classId, role: "TEACHER" }, include: { user: { select: { name: true } } } }))?.user.name ?? "";
  return {
    id: c.id,
    studentId: c.studentId,
    classId: c.student.classId,
    studentName: c.student.fullName,
    title: c.title,
    reason: c.reason,
    kind: c.kind,
    issuedAt: c.issuedAt,
    schoolName: c.student.class.school.name,
    teacherName: teacher,
    verifyCode: c.verifyCode,
    qr: await QRCode.toDataURL(verifyUrl(c.verifyCode), { margin: 0, width: 160 }),
  };
}
export type CertificateData = Awaited<ReturnType<typeof certificateView>>;
