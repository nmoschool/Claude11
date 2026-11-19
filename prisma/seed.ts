/**
 * بيانات أولية لبيئة التطوير/التجربة.
 * ⚠️ يمسح كل الجداول قبل التعبئة. يرفض العمل في الإنتاج إلا مع SEED_FORCE=true.
 *
 * التواريخ وأسماء الطالبات تجريبية؛ عدّلي تواريخ الفصول وفق التقويم الدراسي الرسمي.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptField } from "../src/lib/crypto";
import { randomJoinCode, randomPictureCode, serializeCode, codeToLabels, AVATARS } from "../src/lib/pictureCode";

const prisma = new PrismaClient();

const SKILLS: [string, string, string][] = [
  ["READ.ALOUD", "القراءة", "القراءة الجهرية"],
  ["READ.COMP", "القراءة", "الفهم القرائي"],
  ["LISTEN", "الاستماع والتحدث", "الاستماع"],
  ["SPEAK", "الاستماع والتحدث", "التحدث"],
  ["SPELL.SHAMS_QAMAR", "الرسم الإملائي", "اللام الشمسية والقمرية"],
  ["SPELL.TAA", "الرسم الإملائي", "التاء المربوطة والمفتوحة"],
  ["SPELL.HAMZA_START", "الرسم الإملائي", "همزتا الوصل والقطع"],
  ["SPELL.ALIF_LAYYINA", "الرسم الإملائي", "الألف اللينة"],
  ["SPELL.TANWEEN", "الرسم الإملائي", "التنوين"],
  ["HAND.NASKH", "الرسم الكتابي", "خط النسخ"],
  ["LEX.NUMBER", "الصنف اللغوي", "المفرد والمثنى والجمع"],
  ["LEX.PRONOUN", "الصنف اللغوي", "الضمائر"],
  ["LEX.DEMONSTRATIVE", "الصنف اللغوي", "أسماء الإشارة"],
  ["LEX.RELATIVE", "الصنف اللغوي", "الأسماء الموصولة"],
  ["LEX.VERB_TENSE", "الصنف اللغوي", "الفعل الماضي والمضارع والأمر"],
  ["GRAM.NOMINAL", "الوظيفة النحوية", "الجملة الاسمية (المبتدأ والخبر)"],
  ["GRAM.VERBAL", "الوظيفة النحوية", "الجملة الفعلية (الفعل والفاعل)"],
  ["GRAM.PREP", "الوظيفة النحوية", "حروف الجر"],
  ["STYLE.EXCLAIM", "الأسلوب والتركيب", "أسلوب التعجب"],
  ["STYLE.QUESTION", "الأسلوب والتركيب", "أسلوب الاستفهام"],
  ["STYLE.VOCATIVE", "الأسلوب والتركيب", "أسلوب النداء"],
  ["WRITE.EXPR", "التواصل الكتابي", "التعبير الكتابي"],
];

// أسماء تجريبية عامة (ليست لأشخاص حقيقيين)
const FIRST = ["سارة", "نورة", "ريم", "لمى", "جود", "رهف", "شهد", "لين", "غلا", "ديم", "تالا", "رزان", "جنى", "وعد", "ليان", "مها", "هيا", "دانة", "أسيل", "رغد", "سلمى", "ملاك", "يارا", "لجين", "ميار", "عهد", "بشرى", "آلاء", "حلا", "روان", "شوق", "فجر", "نجد", "مريم", "هتان", "جوري"];
const FATHER = ["محمد", "عبدالله", "خالد", "فهد", "سعد", "ناصر", "علي", "عمر", "سلطان", "تركي", "ماجد", "إبراهيم"];
const FAMILY = ["العتيبي", "القحطاني", "الغامدي", "الزهراني", "الشهري", "الحربي", "المطيري", "الدوسري", "العنزي", "السبيعي", "الشمري", "المالكي"];

function weeksBetween(start: Date, end: Date) {
  const weeks: { number: number; start: Date; end: Date }[] = [];
  let s = new Date(start);
  let n = 1;
  while (s <= end) {
    const e = new Date(s);
    e.setUTCDate(e.getUTCDate() + 4); // الأحد ← الخميس
    weeks.push({ number: n++, start: new Date(s), end: e > end ? end : e });
    s.setUTCDate(s.getUTCDate() + 7);
  }
  return weeks;
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "true") {
    throw new Error("رفض التشغيل في الإنتاج: البذرة تمسح البيانات. استخدمي SEED_FORCE=true إن كنتِ متأكدة.");
  }

  const tables: { tablename: string }[] = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`
    );
  }

  const school = await prisma.school.create({
    data: { name: process.env.SEED_SCHOOL_NAME ?? "المدرسة الابتدائية النموذجية", region: "الإدارة العامة للتعليم" },
  });

  const year = await prisma.academicYear.create({ data: { schoolId: school.id, label: "1448هـ", current: true } });
  const termDefs = [
    { number: 1, title: "الفصل الدراسي الأول", start: "2026-08-23", end: "2027-01-07" },
    { number: 2, title: "الفصل الدراسي الثاني", start: "2027-01-17", end: "2027-06-10" },
  ];
  for (const t of termDefs) {
    const start = new Date(`${t.start}T00:00:00Z`);
    const end = new Date(`${t.end}T00:00:00Z`);
    await prisma.term.create({
      data: {
        yearId: year.id,
        number: t.number,
        title: t.title,
        startDate: start,
        endDate: end,
        weeks: { create: weeksBetween(start, end) },
      },
    });
  }

  await prisma.skill.createMany({ data: SKILLS.map(([code, domain, title]) => ({ code, domain, title })) });

  const classes = [];
  for (const section of ["أ", "ب", "ج"]) {
    classes.push(await prisma.schoolClass.create({ data: { schoolId: school.id, grade: 4, section, joinCode: randomJoinCode() } }));
  }
  const [A, B, C] = classes;

  const mk = async (email: string, name: string, role: Role, password: string, links: { classId: string; role: "TEACHER" | "SUPERVISOR" }[] = []) =>
    prisma.user.create({
      data: {
        schoolId: school.id,
        email,
        name,
        role,
        passwordHash: await bcrypt.hash(password, 12),
        classLinks: { create: links },
      },
    });

  const accounts = [
    { email: process.env.SEED_ADMIN_EMAIL ?? "admin@school.sa", name: "مدير النظام", role: Role.SUPER_ADMIN, password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!", links: [] },
    { email: "principal@school.sa", name: "أ. هند (القائدة)", role: Role.SCHOOL_ADMIN, password: "Principal123!", links: [] },
    { email: "teacher@school.sa", name: "أ. نوف (معلمة لغتي)", role: Role.TEACHER, password: "Teacher123!", links: [{ classId: A.id, role: "TEACHER" as const }, { classId: B.id, role: "TEACHER" as const }] },
    { email: "teacher2@school.sa", name: "أ. منيرة (معلمة لغتي)", role: Role.TEACHER, password: "Teacher123!", links: [{ classId: C.id, role: "TEACHER" as const }] },
    { email: "supervisor@school.sa", name: "أ. عائشة (المشرفة التربوية)", role: Role.SUPERVISOR, password: "Supervisor123!", links: [{ classId: A.id, role: "SUPERVISOR" as const }, { classId: B.id, role: "SUPERVISOR" as const }] },
  ];
  for (const a of accounts) await mk(a.email, a.name, a.role, a.password, a.links);

  const cards: string[] = [];
  let n = 0;
  for (const cls of classes) {
    for (let i = 0; i < 12; i++) {
      const first = FIRST[n % FIRST.length];
      const fullName = `${first} ${FATHER[(n * 7) % FATHER.length]} ${FAMILY[(n * 5) % FAMILY.length]}`;
      const nationalId = `1${String(100000000 + n * 7919).slice(-9)}`;
      const code = randomPictureCode();
      await prisma.student.create({
        data: {
          classId: cls.id,
          fullName,
          displayName: first,
          avatar: AVATARS[n % AVATARS.length],
          nationalIdEnc: encryptField(nationalId),
          nationalIdLast4: nationalId.slice(-4),
          guardianName: `${FATHER[(n * 7) % FATHER.length]} ${FAMILY[(n * 5) % FAMILY.length]}`,
          guardianPhoneEnc: encryptField(`05${String(10000000 + n * 1237).slice(-8)}`),
          healthNotesEnc: n % 9 === 0 ? encryptField("تستخدم نظارة طبية — تُجلس في الصفوف الأمامية") : null,
          pictureCodeHash: await bcrypt.hash(serializeCode(code), 10),
        },
      });
      if (i < 2) cards.push(`  الرابع/${cls.section} (رمز الفصل ${cls.joinCode}) — ${first}: ${codeToLabels(code)}`);
      n++;
    }
  }

  console.log("✅ تمت التعبئة\n");
  console.log("حسابات الطاقم (سيُطلب تفعيل التحقق الثنائي عند أول دخول):");
  for (const a of accounts) console.log(`  ${a.name.padEnd(28)} ${a.email.padEnd(24)} ${a.password}`);
  console.log("\nنماذج دخول الطالبات (بقية الرموز تُولَّد من صفحة الفصل ← بطاقات الدخول):");
  console.log(cards.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
