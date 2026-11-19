import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, assertScope } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { GAME_CODES, type GameCode } from "@/lib/games";

const Body = z.object({
  leaderboardVisible: z.boolean().optional(),
  disabledGames: z.array(z.enum(GAME_CODES as [GameCode, ...GameCode[]])).max(GAME_CODES.length).optional(),
});

/** تفعيل/تعطيل ألعاب لفصل وإظهار/إخفاء لوحة الشرف */
export const PATCH = withPermission<{ id: string }>("games:manage", async (req, ctx, { id }) => {
  assertScope(ctx, id);
  const body = Body.parse(await req.json());
  const before = await prisma.schoolClass.findUniqueOrThrow({ where: { id }, select: { leaderboardVisible: true, disabledGames: true } });
  await prisma.schoolClass.update({ where: { id }, data: body });
  await audit({ actorId: ctx.id, action: "GAMES_SETTINGS", entity: "SchoolClass", entityId: id, before, after: body });
  return { ok: true };
});
