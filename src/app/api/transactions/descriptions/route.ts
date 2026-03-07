import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ descriptions: [] });

  const rows = await prisma.transaction.findMany({
    where: {
      userId: session.userId,
      description: { startsWith: q, mode: "insensitive" },
    },
    select: { description: true },
    distinct: ["description"],
    orderBy: { description: "asc" },
    take: 10,
  });

  return NextResponse.json({ descriptions: rows.map((r) => r.description) });
}
