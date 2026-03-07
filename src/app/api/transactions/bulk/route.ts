import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { ids, all, type, search, tagId } = body as {
    ids?: string[];
    all?: boolean;
    type?: string;
    search?: string;
    tagId?: string;
  };

  const baseWhere: Record<string, unknown> = { userId: session.userId };

  let where: Record<string, unknown>;
  if (all) {
    where = { ...baseWhere };
    if (type && ["INCOME", "EXPENSE", "TRANSFER"].includes(type)) where.type = type;
    if (search) where.description = { contains: search, mode: "insensitive" };
    if (tagId) where.tags = { some: { tagId } };
  } else if (ids?.length) {
    where = { ...baseWhere, id: { in: ids } };
  } else {
    return NextResponse.json({ error: "No transactions specified" }, { status: 400 });
  }

  const transactions = await prisma.transaction.findMany({
    where,
    select: { id: true, amount: true, type: true, bankAccountId: true, toAccountId: true },
  });

  if (transactions.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const accountDeltas = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === "TRANSFER") {
      accountDeltas.set(tx.bankAccountId, (accountDeltas.get(tx.bankAccountId) ?? 0) + tx.amount);
      if (tx.toAccountId) {
        accountDeltas.set(tx.toAccountId, (accountDeltas.get(tx.toAccountId) ?? 0) - tx.amount);
      }
    } else {
      const delta = tx.type === "INCOME" ? -tx.amount : tx.amount;
      accountDeltas.set(tx.bankAccountId, (accountDeltas.get(tx.bankAccountId) ?? 0) + delta);
    }
  }

  const txIds = transactions.map((t) => t.id);

  await prisma.$transaction(async (tx) => {
    for (const [accountId, delta] of accountDeltas) {
      if (delta !== 0) {
        await tx.bankAccount.update({
          where: { id: accountId },
          data: { currentBalance: { increment: delta } },
        });
      }
    }
    await tx.transaction.deleteMany({ where: { id: { in: txIds } } });
  });

  return NextResponse.json({ deleted: txIds.length });
}
