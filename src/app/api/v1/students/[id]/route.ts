import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { StudentFields, loadStudentInScope, studentData, studentProfile } from "@/lib/studentService";

export const GET = withPermission<{ id: string }>("students:read", async (_req, ctx, { id }) => {
  const p = await studentProfile(ctx, id);
  if (p.sensitive) await audit({ actorId: ctx.id, action: "SENSITIVE_VIEW", entity: "Student", entityId: id });
  return p;
});

const Patch = StudentFields.partial().extend({ archived: z.boolean().optional(), classId: z.string().optional() });

export const PATCH = withPermission<{ id: string }>("students:write", async (req, ctx, { id }) => {
  const body = Patch.parse(await req.json());
  const before = await loadStudentInScope(ctx, id);
  if (body.classId && body.classId !== before.classId) {
    const target = await prisma.schoolClass.findFirst({ where: { id: body.classId, schoolId: ctx.schoolId } });
    if (!target || !ctx.inScope(body.classId)) throw new HttpError(403, "OUT_OF_SCOPE", "لا يمكنك النقل إلى هذا الفصل");
  }
  const { archived, classId, ...fields } = body;
  const data = await studentData(ctx, before.classId, fields, id);
  await prisma.student.update({ where: { id }, data: { ...data, archived, classId } });
  // لا تُسجَّل القيم الحساسة نفسها في التدقيق — أسماء الحقول المعدّلة فقط
  await audit({
    actorId: ctx.id,
    action: archived === true ? "STUDENT_ARCHIVED" : archived === false ? "STUDENT_RESTORED" : classId ? "STUDENT_MOVED" : "STUDENT_UPDATED",
    entity: "Student",
    entityId: id,
    before: { fullName: before.fullName, classId: before.classId, archived: before.archived },
    after: { fields: Object.keys(body), classId, archived },
  });
  return { ok: true };
});
