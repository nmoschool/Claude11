import { notFound } from "next/navigation";
import { requireStaffPage, HttpError } from "@/lib/guard";
import { studentProfile } from "@/lib/studentService";
import { audit } from "@/lib/audit";
import { classLabel } from "@/lib/classes";
import { prisma } from "@/lib/prisma";
import ClassTabs from "@/components/ClassTabs";
import StudentProfile from "@/components/StudentProfile";

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const ctx = await requireStaffPage("students:read");
  let profile;
  try {
    profile = await studentProfile(ctx, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  if (profile.sensitive) await audit({ actorId: ctx.id, action: "SENSITIVE_VIEW", entity: "Student", entityId: id });
  const cls = await prisma.schoolClass.findUniqueOrThrow({ where: { id: profile.student.classId } });
  const classId = cls.id;

  return (
    <div>
      <ClassTabs classId={classId} label={classLabel(cls)} showCalendar={ctx.can("curriculum:read")} />
      <StudentProfile
        profile={JSON.parse(JSON.stringify(profile))}
        initialTab={tab}
        perms={{
          write: ctx.can("students:write", classId),
          sensitive: ctx.can("students:sensitive", classId),
          behavior: ctx.can("behavior:write", classId),
          files: ctx.can("files:upload", classId),
          supervisorNote: ctx.can("supervision:comment", classId),
          isSupervisor: ctx.role === "SUPERVISOR",
          privacy: ctx.can("users:manage") && ctx.can("students:sensitive", classId),
        }}
      />
    </div>
  );
}
