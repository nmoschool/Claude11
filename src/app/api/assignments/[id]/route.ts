import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      class: true,
      worksheet: { include: { questions: { orderBy: { order: "asc" } } } },
      submissions: {
        include: { student: true, answers: true },
        orderBy: { student: { fullName: "asc" } },
      },
    },
  });

  if (!assignment) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(assignment);
}
