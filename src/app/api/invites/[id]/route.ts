import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = await request.json();

  if (!["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invite = await prisma.sharedBudgetInvite.findFirst({
    where: { id, invitedEmail: user.email, status: "PENDING" },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  if (action === "accept") {
    await prisma.$transaction([
      prisma.sharedBudgetInvite.update({
        where: { id },
        data: { status: "ACCEPTED", invitedUserId: session.userId },
      }),
      prisma.budgetShare.create({
        data: { budgetId: invite.budgetId, userId: session.userId },
      }),
    ]);
  } else {
    await prisma.sharedBudgetInvite.update({
      where: { id },
      data: { status: "REJECTED", invitedUserId: session.userId },
    });
  }

  return NextResponse.json({ success: true });
}
