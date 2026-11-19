import { withPermission, HttpError } from "@/lib/guard";
import { classCalendar } from "@/lib/calendarService";
import { parseDay } from "@/lib/dates";

export const GET = withPermission<{ id: string }>("curriculum:read", async (req, ctx, { id }) => {
  const url = new URL(req.url);
  let from: Date, to: Date;
  try {
    from = parseDay(url.searchParams.get("from") ?? "");
    to = parseDay(url.searchParams.get("to") ?? "");
  } catch (e) {
    throw new HttpError(400, "INVALID_DATE", (e as Error).message);
  }
  if (to.getTime() - from.getTime() > 120 * 86_400_000) throw new HttpError(400, "RANGE_TOO_LONG", "المدى الأقصى 120 يوماً");
  return classCalendar(ctx, id, from, to);
});
