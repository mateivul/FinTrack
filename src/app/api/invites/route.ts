import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!user) return NextResponse.json({ invites: [] });

  await prisma.sharedBudgetInvite.updateMany({
    where: { invitedEmail: user.email, invitedUserId: null, status: "PENDING" },
    data: { invitedUserId: session.userId },
  });

  const invites = await prisma.sharedBudgetInvite.findMany({
    where: { invitedEmail: user.email, status: "PENDING" },
    include: {
      budget: { select: { id: true, name: true, amount: true, period: true } },
      inviter: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invites });
}
