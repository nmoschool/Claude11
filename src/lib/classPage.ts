import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { StaffContext } from "@/lib/guard";
import { classLabel } from "@/lib/classes";

export async function loadClassPage(ctx: StaffContext, id: string) {
  if (!ctx.inScope(id)) notFound();
  const cls = await prisma.schoolClass.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!cls) notFound();
  return { cls, label: classLabel(cls) };
}
