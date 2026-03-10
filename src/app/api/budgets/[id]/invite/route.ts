import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: budgetId } = await params;
  const { email } = await request.json();

  if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId: session.userId },
  });
  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });

  const invitedUser = await prisma.user.findUnique({ where: { email } });

  if (invitedUser?.id === session.userId) {
    return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
  }

  if (invitedUser) {
    const alreadyMember = await prisma.budgetShare.findUnique({
      where: { budgetId_userId: { budgetId, userId: invitedUser.id } },
    });
    if (alreadyMember) return NextResponse.json({ error: "Already a member" }, { status: 409 });
  }

  const existingInvite = await prisma.sharedBudgetInvite.findFirst({
    where: { budgetId, invitedEmail: email, status: "PENDING" },
  });
  if (existingInvite) {
    return NextResponse.json({ error: "Invite already sent" }, { status: 409 });
  }

  const invite = await prisma.sharedBudgetInvite.create({
    data: {
      budgetId,
      inviterUserId: session.userId,
      invitedEmail: email,
      invitedUserId: invitedUser?.id ?? null,
      status: "PENDING",
    },
  });

  return NextResponse.json({ invite }, { status: 201 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: budgetId } = await params;
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId: session.userId },
  });
  if (!budget) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invites = await prisma.sharedBudgetInvite.findMany({
    where: { budgetId, status: "PENDING" },
    select: { id: true, invitedEmail: true, createdAt: true },
  });

  return NextResponse.json({ invites });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: budgetId } = await params;
  const { userId: memberUserId } = await request.json();

  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId: session.userId },
  });
  if (!budget) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.budgetShare.deleteMany({
    where: { budgetId, userId: memberUserId },
  });

  return NextResponse.json({ success: true });
}
