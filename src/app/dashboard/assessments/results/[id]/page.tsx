import { requireStaffPage } from "@/lib/guard";
import AssessmentResults from "@/components/AssessmentResults";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("assessments:read");
  return <AssessmentResults publicationId={id} canGrade={ctx.can("grades:write")} />;
}
