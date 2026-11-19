import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { tempPassword } from "@/lib/validation";
import { loadManagedUser } from "@/lib/userAdmin";

export const POST = withPermission<{ id: string }>("users:manage", async (_req, ctx, { id }) => {
  await loadManagedUser(ctx, id);
  const password = tempPassword();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 12), failedLogins: 0, lockedUntil: null },
  });
  await audit({ actorId: ctx.id, action: "PASSWORD_RESET", entity: "User", entityId: id });
  return { tempPassword: password };
});
