import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, assertScope } from "@/lib/guard";
import { audit } from "@/lib/audit";

export const GET = withPermission<{ id: string }>("students:read", async (_req, ctx, { id }) => {
  assertScope(ctx, id);
  const comments = await prisma.supervisorComment.findMany({
    where: { classId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const authors = await prisma.user.findMany({
    where: { id: { in: comments.map((c) => c.authorId) } },
    select: { id: true, name: true },
  });
  const names = Object.fromEntries(authors.map((a) => [a.id, a.name]));
  return { comments: comments.map((c) => ({ ...c, authorName: names[c.authorId] ?? "—" })) };
});

const Body = z.object({
  body: z.string().trim().min(3).max(2000),
  targetType: z.enum(["CLASS", "STUDENT", "LESSON", "GRADE_ITEM"]).default("CLASS"),
  targetId: z.string().optional(),
});

/** القناة الوحيدة للكتابة لدى المشرفة: ملاحظة منفصلة لا تعدّل بيانات المعلمة */
export const POST = withPermission<{ id: string }>("supervision:comment", async (req, ctx, { id }) => {
  assertScope(ctx, id);
  const body = Body.parse(await req.json());
  const c = await prisma.supervisorComment.create({
    data: { authorId: ctx.id, classId: id, targetType: body.targetType, targetId: body.targetId ?? id, body: body.body },
  });
  await audit({ actorId: ctx.id, action: "SUPERVISOR_COMMENT", entity: "SchoolClass", entityId: id, after: { commentId: c.id } });
  return { id: c.id };
});
