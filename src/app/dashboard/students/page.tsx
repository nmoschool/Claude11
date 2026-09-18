import { prisma } from "@/lib/prisma";
import StudentsClient from "@/components/StudentsClient";

export default async function StudentsPage() {
  const students = await prisma.student.findMany({
    where: { active: true },
    include: { class: true },
    orderBy: [{ class: { name: "asc" } }, { fullName: "asc" }],
  });

  return <StudentsClient students={students} />;
}
