import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { buildXlsx } from "@/lib/spreadsheet";
import { PLAN_COLUMNS, LESSON_KINDS } from "@/lib/curriculum";

/** قالب Excel للتوزيع: ورقة أولى بمثالين (تُستورد) + أوراق مرجعية للمهارات والمكوّنات */
export const GET = withPermission("curriculum:read", async () => {
  const skills = await prisma.skill.findMany({ orderBy: { code: "asc" } });
  const buf = await buildXlsx(
    {
      name: "التوزيع",
      headers: PLAN_COLUMNS,
      rows: [
        [1, "الوحدة الأولى", "نص الفهم القرائي", "نص قرائي", 2, "أن تقرأ الطالبة النص قراءة جهرية سليمة؛ أن تجيب عن أسئلة الفهم", "READ.ALOUD, READ.COMP"],
        [1, "", "اللام الشمسية والقمرية", "الرسم الإملائي", 1, "أن تميّز الطالبة بين اللام الشمسية والقمرية", "SPELL.SHAMS_QAMAR"],
      ],
    },
    { name: "رموز المهارات", headers: ["الرمز", "المهارة", "المجال"], rows: skills.map((s) => [s.code, s.title, s.domain]) },
    { name: "المكوّنات", headers: ["المكوّن"], rows: Object.values(LESSON_KINDS).map((k) => [k]) }
  );
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("قالب-توزيع-المنهج.xlsx")}`,
    },
  });
});
