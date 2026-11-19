import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok", dbLatencyMs: Date.now() - t });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
