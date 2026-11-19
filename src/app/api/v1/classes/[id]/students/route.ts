import { prisma } from "@/lib/prisma";
import { withPermission, assertScope } from "@/lib/guard";
import { listStudents } from "@/lib/classes";
import { audit } from "@/lib/audit";
import { StudentFields, studentData } from "@/lib/studentService";
import { AVATARS } from "@/lib/pictures";

export const GET = withPermission<{ id: string }>("students:read", async (req, ctx, { id }) => {
  assertScope(ctx, id);
  const archived = new URL(req.url).searchParams.get("archived") === "1";
  const students = await listStudents(ctx, id, { archived });
  if (ctx.can("students:sensitive", id)) {
    // الاطلاع على البيانات الحساسة يُسجَّل (مبدأ المساءلة في PDPL)
    await audit({ actorId: ctx.id, action: "SENSITIVE_VIEW", entity: "SchoolClass", entityId: id });
  }
  return { students };
});

export const POST = withPermission<{ id: string }>("students:write", async (req, ctx, { id }) => {
  assertScope(ctx, id);
  const input = StudentFields.parse(await req.json());
  const data = await studentData(ctx, id, input);
  const count = await prisma.student.count({ where: { classId: id } });
  const s = await prisma.student.create({
    data: { classId: id, avatar: AVATARS[count % AVATARS.length], ...(data as { fullName: string; displayName: string }) },
  });
  await audit({ actorId: ctx.id, action: "STUDENT_CREATED", entity: "Student", entityId: s.id, after: { fullName: s.fullName, classId: id } });
  return { id: s.id };
});
