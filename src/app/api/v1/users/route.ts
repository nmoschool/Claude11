import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { tempPassword } from "@/lib/validation";
import { effectivePermissions } from "@/lib/permissions";
import { assertAssignableRole, assertClassesInSchool } from "@/lib/userAdmin";

export const GET = withPermission("users:manage", async (_req, ctx) => {
  const users = await prisma.user.findMany({
    where: { schoolId: ctx.schoolId },
    include: { permissions: true, classLinks: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      totpEnabled: u.totpEnabled,
      lockedUntil: u.lockedUntil,
      lastLoginAt: u.lastLoginAt,
      overrides: u.permissions.map((p) => ({ permission: p.permission, granted: p.granted })),
      effective: effectivePermissions(u.role, u.permissions),
      classLinks: u.classLinks.map((l) => ({ classId: l.classId, role: l.role })),
    })),
  };
});

const Create = z.object({
  name: z.string().trim().min(3).max(100),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["SCHOOL_ADMIN", "TEACHER", "SUPERVISOR"]),
  classIds: z.array(z.string()).default([]),
});

export const POST = withPermission("users:manage", async (req, ctx) => {
  const body = Create.parse(await req.json());
  assertAssignableRole(ctx, body.role);
  await assertClassesInSchool(ctx, body.classIds);
  if (await prisma.user.findUnique({ where: { email: body.email } })) {
    throw new HttpError(409, "EMAIL_TAKEN", "البريد مستخدم مسبقاً");
  }
  const password = tempPassword();
  const linkRole = body.role === "SUPERVISOR" ? "SUPERVISOR" : "TEACHER";
  const user = await prisma.user.create({
    data: {
      schoolId: ctx.schoolId,
      name: body.name,
      email: body.email,
      role: body.role,
      passwordHash: await bcrypt.hash(password, 12),
      classLinks:
        body.role === "SCHOOL_ADMIN"
          ? undefined
          : { create: body.classIds.map((classId) => ({ classId, role: linkRole })) },
    },
  });
  await audit({
    actorId: ctx.id,
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    after: { name: body.name, email: body.email, role: body.role, classIds: body.classIds },
  });
  return { id: user.id, tempPassword: password };
});
