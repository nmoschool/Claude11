import { notFound } from "next/navigation";
import { requireStudentPage } from "@/lib/guard";
import { GAMES, type GameCode } from "@/lib/games";
import GamePlayer from "@/components/GamePlayer";

export default async function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const s = await requireStudentPage();
  const { code } = await params;
  if (!(code in GAMES)) notFound();
  return <GamePlayer studentId={s.id} code={code as GameCode} />;
}
