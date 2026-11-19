import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadStudentInScope } from "@/lib/studentService";

const Body = z.object({
  kind: z.enum(["ACADEMIC", "GUARDIAN_CONTACT", "REMEDIAL", "SUPERVISOR"]),
  body: z.string().trim().min(2).max(3000),
  visibleToSupervisor: z.boolean().default(true),
});

/**
 * المعلمة: ملاحظات أكاديمية/تواصل/علاجية (بصلاحية behavior:write).
 * المشرفة: ملاحظة من نوع SUPERVISOR فقط (بصلاحية supervision:comment).
 */
export const POST = withPermission<{ id: string }>(["behavior:write", "supervision:comment"], async (req, ctx, { id }) => {
  const s = await loadStudentInScope(ctx, id);
  const body = Body.parse(await req.json());
  const perm = body.kind === "SUPERVISOR" ? "supervision:comment" : "behavior:write";
  if (!ctx.can(perm, s.classId)) throw new HttpError(403, "FORBIDDEN", "لا تملكين صلاحية إضافة هذا النوع من الملاحظات");
  const n = await prisma.studentNote.create({
    data: { studentId: id, authorId: ctx.id, kind: body.kind, body: body.body, visibleToSupervisor: body.kind === "SUPERVISOR" ? true : body.visibleToSupervisor },
  });
  await audit({ actorId: ctx.id, action: "NOTE_ADDED", entity: "Student", entityId: id, after: { noteId: n.id, kind: body.kind } });
  return { id: n.id };
});
