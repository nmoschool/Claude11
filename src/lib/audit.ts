import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function audit(entry: {
  actorId?: string | null;
  actorType?: "USER" | "STUDENT" | "SYSTEM";
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorType === "STUDENT" ? null : entry.actorId ?? null,
        actorType: entry.actorType ?? "USER",
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: entry.reason,
        ip: entry.ip,
      },
    });
  } catch (e) {
    // لا نُفشل العملية الأصلية بسبب فشل التدقيق، لكن نسجّله
    console.error("audit failed", e);
  }
}
