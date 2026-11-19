import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/guard";
import SecuritySettings from "@/components/SecuritySettings";

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const ctx = await requireStaffPage();
  const { setup } = await searchParams;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.id } });
  return <SecuritySettings totpEnabled={user.totpEnabled} forced={!!setup && ctx.mfaSetupRequired} />;
}
