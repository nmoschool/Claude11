import { withStudent } from "@/lib/studentGuard";
import { gameContent, enabledGames } from "@/lib/gameService";

/** حزمة محتوى كل الألعاب (تُخزَّن في الجهاز للعب دون اتصال) */
export const GET = withStudent(async (_req, student) => ({
  content: await gameContent(student),
  enabled: await enabledGames(student.classId),
  version: new Date().toISOString(),
}));
