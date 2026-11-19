/**
 * تهيئة عام دراسي جديد في الإنتاج (آمن للتكرار، لا يمسح شيئاً):
 *   docker compose exec app node deploy/setup-year.cjs \
 *     --year "1448هـ" --term1 2026-08-23:2027-01-07 --term2 2027-01-17:2027-06-10 --sections "أ,ب,ج"
 *
 * يُنشئ/يكمل: قاموس المهارات المرجعي، السنة (ويجعلها الحالية)، الفصول الدراسية بأسابيعها (الأحد–الخميس)،
 * مخطط أوزان افتراضي لكل فصل دراسي (يُعدَّل من «⚙️ الأوزان»)، والشُّعب برموز دخول للطالبات.
 * التواريخ ميلادية YYYY-MM-DD. أضيفي الإجازات بعدها من «توزيع المنهج ← الإجازات».
 */
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const path = require("path");

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const DAY = 86400000;
const parseRange = (r) => {
  const m = /^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(r || "");
  if (!m) return null;
  const [s, e] = [new Date(`${m[1]}T00:00:00Z`), new Date(`${m[2]}T00:00:00Z`)];
  return e > s ? [s, e] : null;
};
const weeks = (start, end) => {
  const out = [];
  for (let s = new Date(start), n = 1; s <= end; s = new Date(s.getTime() + 7 * DAY), n++) {
    const e = new Date(s.getTime() + 4 * DAY);
    out.push({ number: n, start: s, end: e > end ? end : e });
  }
  return out;
};
const joinCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[crypto.randomInt(32)]).join("");
const SCALE = [{ min: 90, label: "ممتاز" }, { min: 80, label: "جيد جداً" }, { min: 70, label: "جيد" }, { min: 50, label: "مقبول" }, { min: 0, label: "يحتاج إلى دعم" }];
const COMPONENTS = [
  ["PARTICIPATION", "المشاركة والتفاعل الصفي", 10], ["HOMEWORK", "الواجبات", 10], ["PERFORMANCE", "المهام الأدائية", 20],
  ["QUIZ", "الاختبارات القصيرة", 20], ["MIDTERM", "الاختبار الفتري", 10], ["FINAL", "الاختبار النهائي", 30],
];

(async () => {
  const terms = [args.term1, args.term2, args.term3].map(parseRange);
  const sections = (args.sections || "").split(/[,،]/).map((s) => s.trim()).filter(Boolean);
  if (!args.year || !terms[0] || !sections.length || [args.term2, args.term3].some((t, i) => t && !terms[i + 1])) {
    console.error('الاستخدام: node deploy/setup-year.cjs --year "1448هـ" --term1 YYYY-MM-DD:YYYY-MM-DD [--term2 ...] [--term3 ...] --sections "أ,ب,ج"');
    process.exit(2);
  }
  const p = new PrismaClient();
  try {
    const school = await p.school.findFirst();
    if (!school) throw new Error("أنشئي المدرسة ومدير النظام أولاً: node deploy/create-admin.cjs");
    // 1) قاموس المهارات
    const skills = require(path.join(__dirname, "..", "prisma", "reference-skills.json"));
    for (const s of skills) await p.skill.upsert({ where: { code: s.code }, create: s, update: { title: s.title, domain: s.domain } });
    // 2) السنة الحالية
    let year = await p.academicYear.findFirst({ where: { schoolId: school.id, label: args.year } });
    await p.academicYear.updateMany({ where: { schoolId: school.id }, data: { current: false } });
    year = year ? await p.academicYear.update({ where: { id: year.id }, data: { current: true } }) : await p.academicYear.create({ data: { schoolId: school.id, label: args.year, current: true } });
    // 3) الفصول الدراسية + الأسابيع + الأوزان
    const titles = ["الفصل الدراسي الأول", "الفصل الدراسي الثاني", "الفصل الدراسي الثالث"];
    for (const [i, range] of terms.entries()) {
      if (!range) continue;
      const exists = await p.term.findUnique({ where: { yearId_number: { yearId: year.id, number: i + 1 } } });
      if (exists) { console.log(`• ${titles[i]} موجود مسبقاً — لم يُغيَّر`); continue; }
      const t = await p.term.create({ data: { yearId: year.id, number: i + 1, title: titles[i], startDate: range[0], endDate: range[1], weeks: { create: weeks(range[0], range[1]) } } });
      await p.assessmentScheme.create({ data: { termId: t.id, gradeScale: SCALE, components: { create: COMPONENTS.map(([kind, title, weight], k) => ({ kind, title, weight, order: k + 1 })) } } });
      console.log(`✅ ${titles[i]}: ${weeks(range[0], range[1]).length} أسبوعاً`);
    }
    // 4) الشُّعب
    for (const section of sections) {
      const c = await p.schoolClass.findUnique({ where: { schoolId_grade_section: { schoolId: school.id, grade: 4, section } } });
      if (c) { console.log(`• الرابع/${section} موجود (رمز الدخول ${c.joinCode})`); continue; }
      let code;
      do code = joinCode(); while (await p.schoolClass.findUnique({ where: { joinCode: code } }));
      await p.schoolClass.create({ data: { schoolId: school.id, grade: 4, section, joinCode: code } });
      console.log(`✅ الرابع/${section} — رمز دخول الطالبات ${code}`);
    }
    console.log("\nالتالي: «المستخدمون والصلاحيات» ← إسناد الفصول للمعلمات والمشرفة، ثم استيراد التوزيع والطالبات.");
  } catch (e) {
    console.error("✖", e.message);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
