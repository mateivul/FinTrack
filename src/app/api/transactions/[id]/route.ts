import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validations";
import { demoGuard } from "@/lib/demo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: session.userId },
    include: {
      bankAccount: { select: { id: true, name: true, currency: true } },
      toAccount: { select: { id: true, name: true, currency: true } },
      tags: { include: { tag: true } },
    },
  });

  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ transaction });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoRes = demoGuard(session); if (demoRes) return demoRes;

  const { id } = await params;
  const body = await request.json();
  const parsed = transactionSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { tags, ...txData } = parsed.data;

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      // Reverse old balance effect
      if (existing.type === "TRANSFER") {
        await tx.bankAccount.update({
          where: { id: existing.bankAccountId },
          data: { currentBalance: { increment: existing.amount } },
        });
        if (existing.toAccountId) {
          await tx.bankAccount.update({
            where: { id: existing.toAccountId },
            data: { currentBalance: { decrement: existing.amount } },
          });
        }
      } else {
        const oldDelta = existing.type === "INCOME" ? -existing.amount : existing.amount;
        await tx.bankAccount.update({
          where: { id: existing.bankAccountId },
          data: { currentBalance: { increment: oldDelta } },
        });
      }

      const newType = txData.type ?? existing.type;
      const toAccountId = txData.toAccountId !== undefined
        ? (txData.toAccountId || null)
        : (newType === "TRANSFER" ? existing.toAccountId : null);

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...txData,
          toAccountId,
          date: txData.date ? new Date(txData.date as string) : undefined,
          tags: tags !== undefined ? {
            deleteMany: {},
            create: tags.map((tagId) => ({ tagId })),
          } : undefined,
        },
        include: {
          bankAccount: { select: { id: true, name: true, currency: true } },
          toAccount: { select: { id: true, name: true, currency: true } },
          tags: { include: { tag: true } },
        },
      });

      // Apply new balance effect
      const newAmount = txData.amount ?? existing.amount;
      const accountId = txData.bankAccountId ?? existing.bankAccountId;

      if (newType === "TRANSFER") {
        await tx.bankAccount.update({
          where: { id: accountId },
          data: { currentBalance: { decrement: newAmount } },
        });
        if (toAccountId) {
          await tx.bankAccount.update({
            where: { id: toAccountId },
            data: { currentBalance: { increment: newAmount } },
          });
        }
      } else {
        const newDelta = newType === "INCOME" ? newAmount : -newAmount;
        await tx.bankAccount.update({
          where: { id: accountId },
          data: { currentBalance: { increment: newDelta } },
        });
      }

      return updated;
    });

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Transaction update error:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoRes = demoGuard(session); if (demoRes) return demoRes;

  const { id } = await params;
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: session.userId },
  });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id } });

    if (transaction.type === "TRANSFER") {
      await tx.bankAccount.update({
        where: { id: transaction.bankAccountId },
        data: { currentBalance: { increment: transaction.amount } },
      });
      if (transaction.toAccountId) {
        await tx.bankAccount.update({
          where: { id: transaction.toAccountId },
          data: { currentBalance: { decrement: transaction.amount } },
        });
      }
    } else {
      const delta = transaction.type === "INCOME" ? -transaction.amount : transaction.amount;
      await tx.bankAccount.update({
        where: { id: transaction.bankAccountId },
        data: { currentBalance: { increment: delta } },
      });
    }
  });

  return NextResponse.json({ success: true });
}
