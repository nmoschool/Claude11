import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadManagedUser } from "@/lib/userAdmin";

/** عند فقدان الجوال: يُلغى التحقق الثنائي فتُطالَب المستخدمة بإعداده من جديد عند الدخول */
export const POST = withPermission<{ id: string }>("users:manage", async (_req, ctx, { id }) => {
  await loadManagedUser(ctx, id);
  await prisma.user.update({ where: { id }, data: { totpEnabled: false, totpSecret: null } });
  await audit({ actorId: ctx.id, action: "MFA_RESET", entity: "User", entityId: id });
  return { ok: true };
});
