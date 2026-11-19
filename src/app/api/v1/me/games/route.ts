import { prisma } from "@/lib/prisma";
import { withStudent } from "@/lib/studentGuard";
import { GAMES, GAME_CODES } from "@/lib/games";
import { enabledGames } from "@/lib/gameService";

/** كتالوج الألعاب المفعّلة لفصل الطالبة مع إحصاءاتها الشخصية */
export const GET = withStudent(async (_req, student) => {
  const enabled = await enabledGames(student.classId);
  const stats = await prisma.gameAttempt.groupBy({ by: ["gameCode", "correct"], where: { studentId: student.id }, _count: true, _max: { level: true } });
  return {
    games: GAME_CODES.filter((g) => enabled.includes(g)).map((g) => {
      const rows = stats.filter((s) => s.gameCode === g);
      const total = rows.reduce((s, r) => s + r._count, 0);
      const ok = rows.find((r) => r.correct)?._count ?? 0;
      return { code: g, ...GAMES[g], played: total, accuracy: total ? Math.round((ok / total) * 100) : null, bestLevel: Math.max(0, ...rows.map((r) => r._max.level ?? 0)) };
    }),
  };
});
