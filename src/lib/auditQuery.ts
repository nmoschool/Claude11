import { prisma } from "@/lib/prisma";
import type { StaffContext } from "@/lib/guard";

/**
 * نطاق سجل التدقيق:
 * - القائدة/مدير النظام: كل عمليات منسوبي المدرسة.
 * - المشرفة: عمليات الطاقم المشترك معها في الفصول + العمليات على فصولها.
 */
export async function queryAudit(ctx: StaffContext, take = 100, cursor?: string) {
  let actorIds: string[] | undefined;
  const studentIds = (
    await prisma.student.findMany({
      where: { class: ctx.classWhere() },
      select: { id: true },
    })
  ).map((s) => s.id);
  if (!ctx.schoolWide) {
    const links = await prisma.classStaff.findMany({ where: { classId: { in: ctx.classIds } } });
    actorIds = Array.from(new Set(links.map((l) => l.userId)));
  }
  const rows = await prisma.auditLog.findMany({
    where: actorIds
      ? {
          OR: [
            { actorId: { in: actorIds } },
            { entity: "SchoolClass", entityId: { in: ctx.classIds } },
            { actorType: "STUDENT", entityId: { in: studentIds } },
          ],
        }
      : { OR: [{ actor: { schoolId: ctx.schoolId } }, { actorType: "STUDENT", entityId: { in: studentIds } }] },
    include: { actor: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  return { rows: rows.slice(0, take), nextCursor: hasMore ? rows[take - 1].id : null };
}
