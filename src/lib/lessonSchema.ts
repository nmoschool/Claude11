import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/guard";
import { LESSON_KINDS, type LessonKindName } from "@/lib/curriculum";

const kinds = Object.keys(LESSON_KINDS) as [LessonKindName, ...LessonKindName[]];

export const LessonFields = z.object({
  title: z.string().trim().min(2).max(200),
  kind: z.enum(kinds),
  periods: z.number().int().min(1).max(10).default(1),
  objectives: z.array(z.string().trim().min(1).max(300)).max(15).default([]),
  skillCodes: z.array(z.string()).max(10).default([]),
  weekId: z.string().nullable().optional(),
});

export async function resolveSkills(codes: string[]) {
  if (!codes.length) return [];
  const skills = await prisma.skill.findMany({ where: { code: { in: codes } } });
  const missing = codes.filter((c) => !skills.some((s) => s.code === c));
  if (missing.length) throw new HttpError(400, "UNKNOWN_SKILL", `مهارات غير معروفة: ${missing.join("، ")}`);
  return skills.map((s) => s.id);
}

export async function assertWeekInTerm(weekId: string | null | undefined, termId: string) {
  if (!weekId) return;
  const w = await prisma.week.findFirst({ where: { id: weekId, termId } });
  if (!w) throw new HttpError(400, "INVALID_WEEK", "الأسبوع لا ينتمي لهذا الفصل الدراسي");
}
