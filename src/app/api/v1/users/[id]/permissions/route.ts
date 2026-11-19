import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { ALL_PERMISSIONS, effectivePermissions, type Permission } from "@/lib/permissions";
import { assertGrantable, loadManagedUser } from "@/lib/userAdmin";

const Body = z.object({
  overrides: z.array(
    z.object({ permission: z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]]), granted: z.boolean() })
  ),
});

/** يستبدل كل تخصيصات المستخدم (منح/سحب) دفعة واحدة */
export const PUT = withPermission<{ id: string }>("users:manage", async (req, ctx, { id }) => {
  const { overrides } = Body.parse(await req.json());
  const target = await loadManagedUser(ctx, id);
  assertGrantable(ctx, overrides.filter((o) => o.granted).map((o) => o.permission));

  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId: id } }),
    prisma.userPermission.createMany({ data: overrides.map((o) => ({ userId: id, ...o })) }),
  ]);
  await audit({
    actorId: ctx.id,
    action: "PERMISSIONS_UPDATED",
    entity: "User",
    entityId: id,
    before: target.permissions.map((p) => ({ permission: p.permission, granted: p.granted })),
    after: overrides,
  });
  return { effective: effectivePermissions(target.role, overrides) };
});
