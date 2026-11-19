import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadStudentInScope } from "@/lib/studentService";
import { newVerifyCode } from "@/lib/gameService";

export const GET = withPermission<{ id: string }>("students:read", async (_req, ctx, { id }) => {
  await loadStudentInScope(ctx, id);
  const certs = await prisma.certificate.findMany({ where: { studentId: id }, orderBy: { issuedAt: "desc" } });
  return { certificates: certs.map((c) => ({ id: c.id, title: c.title, kind: c.kind, issuedAt: c.issuedAt, verifyCode: c.verifyCode })) };
});

const Body = z.object({ title: z.string().trim().min(3).max(120), reason: z.string().trim().max(300).optional() });

/** شهادة تقدير يدوية من المعلمة */
export const POST = withPermission<{ id: string }>("certificates:issue", async (req, ctx, { id }) => {
  const s = await loadStudentInScope(ctx, id);
  const b = Body.parse(await req.json());
  const c = await prisma.certificate.create({ data: { studentId: s.id, kind: "MANUAL", title: b.title, reason: b.reason ?? null, verifyCode: newVerifyCode(), issuedBy: ctx.id } });
  await audit({ actorId: ctx.id, action: "CERTIFICATE_ISSUED", entity: "Student", entityId: s.id, after: { certificateId: c.id, title: b.title } });
  return { id: c.id };
});
