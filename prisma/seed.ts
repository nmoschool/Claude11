import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CURRICULUM_PLAN } from "../src/lib/curriculumData";

const prisma = new PrismaClient();

async function main() {
  console.log("بدء التهيئة (seed)...");

  // 1) الفصلان الدراسيان
  const semester1 = await prisma.semester.upsert({
    where: { order_hijriYear: { order: 1, hijriYear: "1448" } },
    update: {},
    create: { name: "الفصل الدراسي الأول", order: 1, hijriYear: "1448" },
  });

  const semester2 = await prisma.semester.upsert({
    where: { order_hijriYear: { order: 2, hijriYear: "1448" } },
    update: {},
    create: { name: "الفصل الدراسي الثاني", order: 2, hijriYear: "1448" },
  });

  const semesterByOrder = { 1: semester1, 2: semester2 } as const;

  // 2) خريطة المنهج
  for (const plan of CURRICULUM_PLAN) {
    const semester = semesterByOrder[plan.semesterOrder];
    for (let i = 0; i < plan.units.length; i++) {
      const unitSeed = plan.units[i];
      const existing = await prisma.curriculumUnit.findFirst({
        where: { grade: plan.grade, semesterId: semester.id, order: i + 1 },
      });

      const unit = existing
        ? await prisma.curriculumUnit.update({
            where: { id: existing.id },
            data: {
              title: unitSeed.title,
              description: unitSeed.description,
              weeksPlan: unitSeed.weeksPlan,
            },
          })
        : await prisma.curriculumUnit.create({
            data: {
              grade: plan.grade,
              semesterId: semester.id,
              order: i + 1,
              title: unitSeed.title,
              description: unitSeed.description,
              weeksPlan: unitSeed.weeksPlan,
            },
          });

      await prisma.lesson.deleteMany({ where: { unitId: unit.id } });
      for (let j = 0; j < unitSeed.lessons.length; j++) {
        await prisma.lesson.create({
          data: {
            unitId: unit.id,
            order: j + 1,
            title: unitSeed.lessons[j].title,
            objectives: unitSeed.lessons[j].objectives,
          },
        });
      }
    }
  }

  // 3) المستخدمون
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@school.sa").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const adminName = process.env.SEED_ADMIN_NAME || "مدير المنصة";

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  const teacherHash = await bcrypt.hash("Teacher123!", 10);
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@school.sa" },
    update: {},
    create: {
      name: "أ. سارة العتيبي",
      email: "teacher@school.sa",
      passwordHash: teacherHash,
      role: "TEACHER",
    },
  });

  // 4) فصل دراسي وطلاب تجريبيون
  const classroom = await prisma.schoolClass.upsert({
    where: { name_grade: { name: "1/أ", grade: 1 } },
    update: { teacherId: teacher.id },
    create: { name: "1/أ", grade: 1, teacherId: teacher.id },
  });

  const demoStudents = [
    "عبدالله محمد القحطاني",
    "سلطان فهد الدوسري",
    "فيصل ناصر الشهري",
    "نورة سعد العتيبي",
    "لمى خالد المطيري",
    "ريان عبدالعزيز الحربي",
  ];

  for (let i = 0; i < demoStudents.length; i++) {
    const studentNumber = `10${i + 1}`;
    await prisma.student.upsert({
      where: { studentNumber },
      update: {},
      create: {
        fullName: demoStudents[i],
        studentNumber,
        grade: 1,
        classId: classroom.id,
      },
    });
  }

  // 5) إعدادات المنصة الافتراضية
  await prisma.setting.upsert({
    where: { key: "branding" },
    update: {},
    create: {
      key: "branding",
      value: JSON.stringify({
        siteName: "منصة رياضيات 1448",
        schoolName: "مدرستي الابتدائية",
        primaryColor: "#158756",
        accentColor: "#f2760c",
        logoUrl: "",
        hijriYear: "1448",
      }),
    },
  });

  console.log("اكتملت التهيئة بنجاح ✅");
  console.log(`مدير النظام: ${adminEmail} / ${adminPassword}`);
  console.log("معلم تجريبي: teacher@school.sa / Teacher123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
