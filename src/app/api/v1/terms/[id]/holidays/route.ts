import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadTerm } from "@/lib/planService";
import { parseDay } from "@/lib/dates";

const Body = z.object({ title: z.string().trim().min(2).max(100), start: z.string(), end: z.string() });

export const POST = withPermission<{ id: string }>("curriculum:write", async (req, ctx, { id }) => {
  const body = Body.parse(await req.json());
  await loadTerm(ctx, id);
  let start: Date, end: Date;
  try {
    start = parseDay(body.start);
    end = parseDay(body.end);
  } catch (e) {
    throw new HttpError(400, "INVALID_DATE", (e as Error).message);
  }
  if (end < start) throw new HttpError(400, "INVALID_RANGE", "تاريخ النهاية قبل البداية");
  const h = await prisma.holiday.create({ data: { termId: id, title: body.title, start, end } });
  await audit({ actorId: ctx.id, action: "HOLIDAY_CREATED", entity: "Holiday", entityId: h.id, after: body });
  return { id: h.id };
});
