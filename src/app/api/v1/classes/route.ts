import { withPermission } from "@/lib/guard";
import { listClasses } from "@/lib/classes";

export const GET = withPermission("students:read", async (_req, ctx) => ({ classes: await listClasses(ctx) }));
