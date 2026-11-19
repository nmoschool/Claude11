import { requireStudentPage } from "@/lib/guard";
import GamesHub from "@/components/GamesHub";

export default async function GamesPage() {
  const s = await requireStudentPage();
  return <GamesHub studentId={s.id} name={s.displayName} />;
}
