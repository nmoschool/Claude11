import { withPermission } from "@/lib/guard";
import { listTerms } from "@/lib/planService";

export const GET = withPermission("curriculum:read", async (_req, ctx) => ({ terms: await listTerms(ctx.schoolId) }));
