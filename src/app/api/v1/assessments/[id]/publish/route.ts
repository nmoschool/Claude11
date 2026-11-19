import { z } from "zod";
import { withPermission, assertScope, HttpError } from "@/lib/guard";
import { publish } from "@/lib/assessmentService";

const Body = z.object({
  classId: z.string(),
  opensAt: z.string().datetime({ offset: true }),
  closesAt: z.string().datetime({ offset: true }).nullable().optional(),
  mode: z.enum(["ONLINE", "PAPER"]).default("ONLINE"),
  toGradebook: z.boolean().default(true),
});

export const POST = withPermission<{ id: string }>("assessments:publish", async (req, ctx, { id }) => {
  const b = Body.parse(await req.json());
  assertScope(ctx, b.classId);
  const opensAt = new Date(b.opensAt);
  const closesAt = b.closesAt ? new Date(b.closesAt) : null;
  if (closesAt && closesAt <= opensAt) throw new HttpError(400, "INVALID_WINDOW", "وقت الإغلاق يجب أن يكون بعد وقت الفتح");
  if (b.toGradebook && !ctx.can("grades:write", b.classId)) throw new HttpError(403, "FORBIDDEN", "الربط بسجل الدرجات يتطلب صلاحية رصد الدرجات");
  const pub = await publish(ctx, id, b.classId, { opensAt, closesAt, mode: b.mode, toGradebook: b.toGradebook });
  return { id: pub.id, gradeItemId: pub.gradeItemId };
});
