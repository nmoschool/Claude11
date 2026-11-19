import { z } from "zod";

export const GradeItemFields = z.object({
  componentId: z.string(),
  title: z.string().trim().min(2).max(120),
  maxScore: z.number().positive().max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  skillCodes: z.array(z.string()).max(8).default([]),
});
