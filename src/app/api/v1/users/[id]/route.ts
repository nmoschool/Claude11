import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { assertAssignableRole, assertClassesInSchool, loadManagedUser } from "@/lib/userAdmin";

const Patch = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  role: z.enum(["SCHOOL_ADMIN", "TEACHER", "SUPERVISOR"]).optional(),
  active: z.boolean().optional(),
  classIds: z.array(z.string()).optional(),
  unlock: z.boolean().optional(),
});

export const PATCH = withPermission<{ id: string }>("users:manage", async (req, ctx, { id }) => {
  const body = Patch.parse(await req.json());
  const target = await loadManagedUser(ctx, id);
  const role = body.role ?? target.role;
  if (body.role) assertAssignableRole(ctx, body.role);
  if (body.classIds) await assertClassesInSchool(ctx, body.classIds);

  const linkRole = role === "SUPERVISOR" ? "SUPERVISOR" : "TEACHER";
  const classIds = role === "SCHOOL_ADMIN" ? [] : body.classIds ?? target.classLinks.map((l) => l.classId);

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        name: body.name,
        role: body.role,
        active: body.active,
        ...(body.unlock ? { lockedUntil: null, failedLogins: 0 } : {}),
      },
    }),
    prisma.classStaff.deleteMany({ where: { userId: id } }),
    prisma.classStaff.createMany({ data: classIds.map((classId) => ({ userId: id, classId, role: linkRole })) }),
  ]);

  await audit({
    actorId: ctx.id,
    action: "USER_UPDATED",
    entity: "User",
    entityId: id,
    before: { name: target.name, role: target.role, active: target.active, classIds: target.classLinks.map((l) => l.classId) },
    after: { name: body.name ?? target.name, role, active: body.active ?? target.active, classIds },
  });
  return { ok: true };
});
