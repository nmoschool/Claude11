/**
 * بيانات أولية لبيئة التطوير/التجربة.
 * ⚠️ يمسح كل الجداول قبل التعبئة. يرفض العمل في الإنتاج إلا مع SEED_FORCE=true.
 *
 * التواريخ وأسماء الطالبات تجريبية؛ عدّلي تواريخ الفصول وفق التقويم الدراسي الرسمي.
 */
import { PrismaClient, Role, type LessonKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptField, hashNationalId } from "../src/lib/crypto";
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
  const skillId = Object.fromEntries((await prisma.skill.findMany()).map((s) => [s.code, s.id]));

  // ---------- توزيع نموذجي للفصل الأول (يُستبدل بالتوزيع الرسمي عبر «استيراد من Excel») ----------
  const term1 = await prisma.term.findFirstOrThrow({ where: { yearId: year.id, number: 1 }, include: { weeks: { orderBy: { number: "asc" } } } });
  const w = (n: number) => term1.weeks[n - 1];
  await prisma.holiday.create({ data: { termId: term1.id, title: "اليوم الوطني", start: new Date("2026-09-23T00:00:00Z"), end: new Date("2026-09-23T00:00:00Z") } });
  await prisma.holiday.create({ data: { termId: term1.id, title: "إجازة (مثال — عدّليها وفق التقويم الرسمي)", start: w(9).start, end: w(9).end } });

  const UNIT_PLAN: { title: string; lessons: [string, LessonKind, string[]][] }[] = [
    {
      title: "الوحدة الأولى (نموذج)",
      lessons: [
        ["نص الاستماع", "LISTENING", ["LISTEN"]],
        ["نص الفهم القرائي الأول", "READING", ["READ.ALOUD", "READ.COMP"]],
        ["الصنف اللغوي: الضمائر المنفصلة", "LEXICAL", ["LEX.PRONOUN"]],
        ["الأسلوب اللغوي: النداء", "GRAMMAR", ["STYLE.VOCATIVE"]],
        ["الرسم الإملائي: اللام الشمسية والقمرية", "SPELLING", ["SPELL.SHAMS_QAMAR"]],
        ["الرسم الكتابي: خط النسخ", "HANDWRITING", ["HAND.NASKH"]],
        ["التواصل الكتابي", "WRITING", ["WRITE.EXPR"]],
        ["التواصل الشفهي", "SPEAKING", ["SPEAK"]],
      ],
    },
    {
      title: "الوحدة الثانية (نموذج)",
      lessons: [
        ["نص الفهم القرائي الثاني", "READING", ["READ.COMP"]],
        ["الصنف اللغوي: المفرد والمثنى والجمع", "LEXICAL", ["LEX.NUMBER"]],
        ["الوظيفة النحوية: الجملة الاسمية", "GRAMMAR", ["GRAM.NOMINAL"]],
        ["الرسم الإملائي: التاء المربوطة والمفتوحة", "SPELLING", ["SPELL.TAA"]],
        ["الرسم الكتابي: حروف متشابهة", "HANDWRITING", ["HAND.NASKH"]],
        ["التواصل الكتابي", "WRITING", ["WRITE.EXPR"]],
        ["مراجعة الوحدة", "REVIEW", []],
      ],
    },
    {
      title: "الوحدة الثالثة (نموذج)",
      lessons: [
        ["نص الفهم القرائي الثالث", "READING", ["READ.ALOUD", "READ.COMP"]],
        ["الصنف اللغوي: الفعل الماضي والمضارع والأمر", "LEXICAL", ["LEX.VERB_TENSE"]],
        ["الوظيفة النحوية: الجملة الفعلية", "GRAMMAR", ["GRAM.VERBAL"]],
        ["الرسم الإملائي: همزتا الوصل والقطع", "SPELLING", ["SPELL.HAMZA_START"]],
        ["الأسلوب اللغوي: التعجب", "GRAMMAR", ["STYLE.EXCLAIM"]],
        ["التواصل الكتابي", "WRITING", ["WRITE.EXPR"]],
        ["مراجعة وتقويم", "REVIEW", []],
      ],
    },
  ];
  // توزيع درسين أسبوعياً على أسابيع الدراسة (تخطّي أسبوع الإجازة 9)
  const teachWeeks = term1.weeks.filter((x) => x.number !== 9);
  let slot = 0;
  const today = new Date();
  for (const [ui, u] of UNIT_PLAN.entries()) {
    const unit = await prisma.unit.create({ data: { termId: term1.id, title: u.title, order: ui + 1 } });
    for (const [li, [title, kind, skills]] of u.lessons.entries()) {
      const week = teachWeeks[Math.min(Math.floor(slot / 2), teachWeeks.length - 1)];
      slot++;
      const past = week.end < today;
      await prisma.lesson.create({
        data: {
          unitId: unit.id,
          order: li + 1,
          title,
          kind,
          periods: kind === "READING" ? 2 : 1,
          weekId: week.id,
          // لتوضيح مؤشر التغطية: معظم الدروس الماضية منفّذة ودرسان متأخران
          status: past && slot % 7 !== 0 ? "DONE" : "PLANNED",
          skills: { create: skills.map((c) => ({ skillId: skillId[c] })) },
        },
      });
    }
  }

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
          nationalIdHash: hashNationalId(nationalId),
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

  // ---------- حضور آخر 10 أيام دراسية لفصل 4/أ + أحداث نموذجية ----------
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher@school.sa" } });
  const aStudents = await prisma.student.findMany({ where: { classId: A.id }, orderBy: { fullName: "asc" } });
  const days: Date[] = [];
  for (let d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1)); days.length < 10; d.setUTCDate(d.getUTCDate() - 1)) {
    if (d.getUTCDay() <= 4) days.push(new Date(d));
  }
  for (const [di, day] of days.entries()) {
    await prisma.attendance.createMany({
      data: aStudents.map((s, si) => ({
        studentId: s.id,
        date: day,
        period: 0,
        // الطالبة الثالثة غائبة آخر 3 أيام لتوضيح تنبيه الغياب المتتالي
        status: si === 2 && di < 3 ? "ABSENT" : (si * 7 + di) % 23 === 0 ? "LATE" : (si * 3 + di) % 29 === 0 ? "EXCUSED" : "PRESENT",
        recordedBy: teacher.id,
      })),
    });
  }
  const addDays = (n: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n));
  /** اليوم الدراسي رقم n بعد اليوم (يتخطى الجمعة والسبت) */
  const schoolDay = (n: number) => {
    const d = addDays(0);
    while (n > 0) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (d.getUTCDay() <= 4) n--;
    }
    return d;
  };
  for (const cls of [A, B]) {
    await prisma.calendarEvent.createMany({
      data: [
        { classId: cls.id, type: "QUIZ", title: "اختبار قصير: الوحدة الثانية", date: schoolDay(3), createdBy: teacher.id },
        { classId: cls.id, type: "HOMEWORK", title: "واجب: كتابة فقرة عن المدرسة", date: schoolDay(1), createdBy: teacher.id },
        { classId: cls.id, type: "ACTIVITY", title: "مسابقة القراءة الجهرية", date: schoolDay(6), createdBy: teacher.id },
      ],
    });
  }
  await prisma.behaviorRecord.createMany({
    data: aStudents.slice(0, 4).map((s, i) => ({ studentId: s.id, date: addDays(-i - 1), category: i === 3 ? "نظام وانضباط" : "مشاركة", positive: i !== 3, points: i === 3 ? 1 : 2, recordedBy: teacher.id })),
  });

  // ---------- مخطط التقييم + درجات نموذجية لفصلي 4/أ و4/ب (الفصل الأول) ----------
  const DEFAULT_SCALE = [
    { min: 90, label: "ممتاز" },
    { min: 80, label: "جيد جداً" },
    { min: 70, label: "جيد" },
    { min: 50, label: "مقبول" },
    { min: 0, label: "يحتاج إلى دعم" },
  ];
  const COMPONENTS = [
    { kind: "PARTICIPATION", title: "المشاركة والتفاعل الصفي", weight: 10 },
    { kind: "HOMEWORK", title: "الواجبات", weight: 10 },
    { kind: "PERFORMANCE", title: "المهام الأدائية", weight: 20 },
    { kind: "QUIZ", title: "الاختبارات القصيرة", weight: 20 },
    { kind: "MIDTERM", title: "الاختبار الفتري", weight: 10 },
    { kind: "FINAL", title: "الاختبار النهائي", weight: 30 },
  ] as const;
  for (const t of await prisma.term.findMany({ where: { yearId: year.id } })) {
    await prisma.assessmentScheme.create({
      data: { termId: t.id, gradeScale: DEFAULT_SCALE, components: { create: COMPONENTS.map((c, i) => ({ ...c, order: i + 1 })) } },
    });
  }
  const scheme1 = await prisma.assessmentScheme.findFirstOrThrow({ where: { termId: term1.id }, include: { components: true } });
  const comp = (k: string) => scheme1.components.find((c) => c.kind === k)!.id;
  const ITEMS: { k: string; title: string; max: number; week: number; skills: string[] }[] = [
    { k: "PARTICIPATION", title: "مشاركة — الشهر الأول", max: 5, week: 4, skills: ["SPEAK"] },
    { k: "PARTICIPATION", title: "مشاركة — الشهر الثاني", max: 5, week: 8, skills: ["SPEAK"] },
    { k: "HOMEWORK", title: "واجب 1", max: 10, week: 2, skills: [] },
    { k: "HOMEWORK", title: "واجب 2", max: 10, week: 5, skills: [] },
    { k: "HOMEWORK", title: "واجب 3", max: 10, week: 10, skills: [] },
    { k: "PERFORMANCE", title: "قراءة جهرية — الوحدة 1", max: 10, week: 4, skills: ["READ.ALOUD"] },
    { k: "PERFORMANCE", title: "تعبير كتابي", max: 10, week: 7, skills: ["WRITE.EXPR"] },
    { k: "QUIZ", title: "قصير 1: اللام الشمسية والقمرية", max: 10, week: 3, skills: ["SPELL.SHAMS_QAMAR"] },
    { k: "QUIZ", title: "قصير 2: الضمائر", max: 10, week: 5, skills: ["LEX.PRONOUN"] },
    { k: "QUIZ", title: "قصير 3: التاء المربوطة والمفتوحة", max: 10, week: 8, skills: ["SPELL.TAA"] },
    { k: "QUIZ", title: "قصير 4: الجملة الاسمية", max: 10, week: 11, skills: ["GRAM.NOMINAL"] },
    { k: "MIDTERM", title: "الاختبار الفتري", max: 40, week: 10, skills: ["READ.COMP", "LEX.NUMBER", "GRAM.NOMINAL"] },
  ];
  // مولّد شبه عشوائي حتمي (نفس النتائج في كل تعبئة)
  let seedN = 1448;
  const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
  for (const cls of [A, B]) {
    const studs = await prisma.student.findMany({ where: { classId: cls.id }, orderBy: { fullName: "asc" } });
    const ability = studs.map((_, i) => 0.42 + ((i * 37) % 55) / 100); // 0.42 .. 0.96
    for (const it of ITEMS) {
      const item = await prisma.gradeItem.create({
        data: {
          classId: cls.id,
          termId: term1.id,
          componentId: comp(it.k),
          title: it.title,
          maxScore: it.max,
          date: new Date(w(it.week).start.getTime() + 2 * 86_400_000),
          skillIds: it.skills.map((c) => skillId[c]),
          createdBy: teacher.id,
        },
      });
      await prisma.gradeEntry.createMany({
        data: studs.map((st, i) => {
          const weakTaa = it.skills.includes("SPELL.TAA") && i % 4 === 1 ? -0.3 : 0;
          const r = Math.min(1, Math.max(0, ability[i] + weakTaa + (rnd() - 0.5) * 0.25));
          const absent = (i === 2 && it.k === "HOMEWORK" && it.title.endsWith("3")) || (i === 7 && it.title.startsWith("قصير 2"));
          const excused = i === 5 && it.k === "MIDTERM";
          return {
            itemId: item.id,
            studentId: st.id,
            score: absent || excused ? null : Math.round(r * it.max * 2) / 2,
            status: absent ? "ABSENT" : excused ? "EXCUSED" : "NORMAL",
            updatedBy: teacher.id,
          } as const;
        }),
      });
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
