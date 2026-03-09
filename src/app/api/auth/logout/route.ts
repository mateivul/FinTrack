import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const session = await getSessionFromRequest(request, response);

  if (session.isDemoSession && session.userId) {
    await prisma.user.deleteMany({
      where: { id: session.userId, isEphemeral: true },
    });
  }

  await session.destroy();
  return response;
}
