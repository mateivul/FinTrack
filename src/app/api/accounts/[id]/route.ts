import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bankAccountSchema } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const account = await prisma.bankAccount.findFirst({
    where: { id, userId: session.userId },
  });

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ account });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = bankAccountSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.bankAccount.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const account = await prisma.bankAccount.update({
    where: { id },
    data: parsed.data,
  });

  if (
    parsed.data.currentBalance !== undefined &&
    parsed.data.currentBalance !== existing.currentBalance
  ) {
    const diff = parsed.data.currentBalance - existing.currentBalance;
    await prisma.transaction.create({
      data: {
        amount: Math.abs(diff),
        type: diff > 0 ? "INCOME" : "EXPENSE",
        date: new Date(),
        description: diff > 0 ? "Balance adjustment (increase)" : "Balance adjustment (decrease)",
        notes: `Manual balance correction: ${existing.currentBalance} → ${parsed.data.currentBalance} ${existing.currency}`,
        source: "MANUAL",
        userId: session.userId,
        bankAccountId: id,
      },
    });
  }

  return NextResponse.json({ account });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.bankAccount.deleteMany({
    where: { id, userId: session.userId },
  });

  return NextResponse.json({ success: true });
}
