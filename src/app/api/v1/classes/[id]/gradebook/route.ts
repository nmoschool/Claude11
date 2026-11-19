import { withPermission, HttpError } from "@/lib/guard";
import { gradebook } from "@/lib/gradebookService";

export const GET = withPermission<{ id: string }>("grades:read", async (req, ctx, { id }) => {
  const term = new URL(req.url).searchParams.get("term");
  if (!term) throw new HttpError(400, "TERM_REQUIRED", "حدّدي الفصل الدراسي");
  return gradebook(ctx, id, term);
});
