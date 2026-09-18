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
  const worksheet = await prisma.worksheet.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      unit: { select: { title: true } },
      createdBy: { select: { name: true } },
      assignments: {
        include: { class: true, submissions: { select: { id: true, status: true } } },
      },
    },
  });

  if (!worksheet) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  return NextResponse.json(worksheet);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.worksheet.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE",
      entity: "Worksheet",
      entityId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
