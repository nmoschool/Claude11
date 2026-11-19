import { requireStudentPage } from "@/lib/guard";
import TakeAssessment from "@/components/TakeAssessment";

export default async function TakePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStudentPage();
  const { id } = await params;
  return <TakeAssessment publicationId={id} />;
}
