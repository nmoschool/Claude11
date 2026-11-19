import { requireStaffPage } from "@/lib/guard";
import { gradebook } from "@/lib/gradebookService";
import { pickClassTerm } from "@/lib/gradebookPage";
import GradebookGrid from "@/components/GradebookGrid";

export default async function GradebookPage({ searchParams }: { searchParams: Promise<{ class?: string; term?: string }> }) {
  const ctx = await requireStaffPage("grades:read");
  const pick = await pickClassTerm(ctx, await searchParams);
  if (!pick.classId || !pick.termId) return <p className="text-gray-500">لا توجد فصول مسندة إليك أو فصول دراسية مُعرّفة.</p>;
  const g = await gradebook(ctx, pick.classId, pick.termId);
  return (
    <GradebookGrid
      key={`${pick.classId}-${pick.termId}`}
      initial={JSON.parse(JSON.stringify(g))}
      classes={pick.classes}
      terms={pick.terms}
      skills={pick.skills}
      perms={{
        write: ctx.can("grades:write", pick.classId),
        lock: ctx.can("grades:lock", pick.classId),
        export: ctx.can("grades:export", pick.classId),
        reports: ctx.can("reports:read", pick.classId),
      }}
    />
  );
}
