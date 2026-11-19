import { withPermission, assertScope } from "@/lib/guard";
import { listStudents } from "@/lib/classes";
import { audit } from "@/lib/audit";

export const GET = withPermission<{ id: string }>("students:read", async (_req, ctx, { id }) => {
  assertScope(ctx, id);
  const students = await listStudents(ctx, id);
  if (ctx.can("students:sensitive", id)) {
    // الاطلاع على البيانات الحساسة يُسجَّل (مبدأ المساءلة في PDPL)
    await audit({ actorId: ctx.id, action: "SENSITIVE_VIEW", entity: "SchoolClass", entityId: id });
  }
  return { students };
});
