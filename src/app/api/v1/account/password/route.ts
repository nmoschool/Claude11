import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { passwordSchema } from "@/lib/validation";

const Body = z.object({ current: z.string().min(1), next: passwordSchema });

export const POST = withPermission(
  null,
  async (req, ctx) => {
    const { current, next } = Body.parse(await req.json());
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.id } });
    if (!(await bcrypt.compare(current, user.passwordHash))) {
      throw new HttpError(400, "INVALID", "كلمة المرور الحالية غير صحيحة");
    }
    await prisma.user.update({
      where: { id: ctx.id },
      data: { passwordHash: await bcrypt.hash(next, 12) },
    });
    await audit({ actorId: ctx.id, action: "PASSWORD_CHANGED", entity: "User", entityId: ctx.id });
    return { ok: true };
  },
  { selfService: true }
);
