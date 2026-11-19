import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { decryptField } from "@/lib/crypto";
import { verifyTotp } from "@/lib/totp";
import { audit } from "@/lib/audit";

const Body = z.object({ code: z.string().regex(/^\d{6}$/) });

export const POST = withPermission(
  null,
  async (req, ctx) => {
    const { code } = Body.parse(await req.json());
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.id } });
    if (!user.totpSecret) throw new HttpError(400, "NO_SECRET", "ابدئي الإعداد أولاً");
    if (!verifyTotp(decryptField(user.totpSecret), code)) {
      throw new HttpError(400, "OTP_INVALID", "الرمز غير صحيح، تأكدي من ضبط وقت الجهاز");
    }
    await prisma.user.update({ where: { id: ctx.id }, data: { totpEnabled: true } });
    await audit({ actorId: ctx.id, action: "MFA_ENABLED", entity: "User", entityId: ctx.id });
    return { ok: true };
  },
  { selfService: true }
);
