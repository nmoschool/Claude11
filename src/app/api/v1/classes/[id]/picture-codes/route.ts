import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withPermission, assertScope } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { randomPictureCode, serializeCode } from "@/lib/pictureCode";
import { classLabel } from "@/lib/classes";

const Body = z.object({ studentIds: z.array(z.string()).min(1).optional() });

/**
 * يولّد رموز صور جديدة ويعيدها **مرة واحدة فقط** للطباعة؛ المخزَّن هو التجزئة.
 * بدون studentIds: كل طالبات الفصل.
 */
export const POST = withPermission<{ id: string }>("students:credentials", async (req, ctx, { id }) => {
  assertScope(ctx, id);
  const { studentIds } = Body.parse(await req.json().catch(() => ({})));
  const cls = await prisma.schoolClass.findUniqueOrThrow({ where: { id } });
  const students = await prisma.student.findMany({
    where: { classId: id, archived: false, ...(studentIds ? { id: { in: studentIds } } : {}) },
    orderBy: { fullName: "asc" },
  });

  const cards = [];
  for (const s of students) {
    const code = randomPictureCode();
    await prisma.student.update({
      where: { id: s.id },
      data: { pictureCodeHash: await bcrypt.hash(serializeCode(code), 10), failedLogins: 0, lockedUntil: null },
    });
    cards.push({ id: s.id, fullName: s.fullName, displayName: s.displayName, avatar: s.avatar, code });
  }
  await audit({
    actorId: ctx.id,
    action: "PICTURE_CODES_RESET",
    entity: "SchoolClass",
    entityId: id,
    after: { count: cards.length, studentIds: cards.map((c) => c.id) },
  });
  return { classLabel: classLabel(cls), joinCode: cls.joinCode, cards };
});
