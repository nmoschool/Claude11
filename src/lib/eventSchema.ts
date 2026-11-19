import { z } from "zod";
import { EVENT_TYPES, type EventTypeName } from "@/lib/curriculum";

const types = Object.keys(EVENT_TYPES) as [EventTypeName, ...EventTypeName[]];

export const EventFields = z.object({
  type: z.enum(types),
  title: z.string().trim().min(2).max(150),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() <= 4, "لا يمكن الجدولة يوم الجمعة أو السبت"),
  note: z.string().trim().max(500).nullable().optional(),
  lessonId: z.string().nullable().optional(),
});
