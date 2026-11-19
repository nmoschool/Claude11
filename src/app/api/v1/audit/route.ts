import { withPermission } from "@/lib/guard";
import { queryAudit } from "@/lib/auditQuery";

export const GET = withPermission("audit:read", async (req, ctx) => {
  const url = new URL(req.url);
  return queryAudit(ctx, 100, url.searchParams.get("cursor") ?? undefined);
});
