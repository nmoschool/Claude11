import { withPermission } from "@/lib/guard";
import { getPlan } from "@/lib/planService";

export const GET = withPermission<{ id: string }>("curriculum:read", (_req, ctx, { id }) => getPlan(ctx, id));
