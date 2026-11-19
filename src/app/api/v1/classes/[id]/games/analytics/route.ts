import { withPermission, assertScope } from "@/lib/guard";
import { gameAnalytics } from "@/lib/gameService";

export const GET = withPermission<{ id: string }>("reports:read", async (req, ctx, { id }) => {
  assertScope(ctx, id);
  const days = Math.min(180, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 30)));
  return gameAnalytics(id, days);
});
