import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { encryptField } from "@/lib/crypto";
import { generateSecret, otpauthUri } from "@/lib/totp";

/** يولّد سراً جديداً (غير مفعّل بعد) ويعيد رمز QR لتطبيق المصادقة */
export const POST = withPermission(
  null,
  async (_req, ctx) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.id } });
    if (user.totpEnabled) throw new HttpError(409, "ALREADY_ENABLED", "التحقق الثنائي مفعّل مسبقاً");
    const secret = generateSecret();
    await prisma.user.update({ where: { id: ctx.id }, data: { totpSecret: encryptField(secret) } });
    const uri = otpauthUri(secret, ctx.email);
    return { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  },
  { selfService: true }
);
