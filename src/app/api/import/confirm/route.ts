import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface TransactionToImport {
  date: string;
  description: string;
  originalDescription?: string;
  patternKey?: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  isDuplicate: boolean;
  skip: boolean;
  tagIds?: string[];
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    importHistoryId,
    accountId,
    transactions,
  }: {
    importHistoryId: string;
    accountId: string;
    transactions: TransactionToImport[];
  } = body;

  if (!accountId || !transactions?.length) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, userId: session.userId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const toImport = transactions.filter((t) => !t.skip && !t.isDuplicate);
  const skipped = transactions.filter((t) => t.skip || t.isDuplicate);

  let importedCount = 0;
  let balanceDelta = 0;

  await prisma.$transaction(async (tx) => {
    for (const t of toImport) {
      await tx.transaction.create({
        data: {
          date: new Date(t.date),
          description: t.description,
          originalDescription: t.originalDescription ?? t.description,
          amount: t.amount,
          type: t.type,
          bankAccountId: accountId,
          userId: session.userId,
          source: "IMPORT",
          importHistoryId,
          tags: t.tagIds?.length
            ? { create: t.tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
      });

      balanceDelta += t.type === "INCOME" ? t.amount : -t.amount;
      importedCount++;
    }

    await tx.bankAccount.update({
      where: { id: accountId },
      data: { currentBalance: { increment: balanceDelta } },
    });

    await tx.importHistory.update({
      where: { id: importHistoryId },
      data: {
        transactionsImported: importedCount,
        transactionsSkipped: skipped.length,
        status: "COMPLETED",
      },
    });
  });

  try {
    const rulesToSave = toImport.filter((t) => t.patternKey);
    for (const t of rulesToSave) {
      await prisma.importRule.upsert({
        where: { userId_pattern: { userId: session.userId, pattern: t.patternKey! } },
        update: {
          description: t.description,
          tags: {
            deleteMany: {},
            create: t.tagIds!.map((tagId) => ({ tagId })),
          },
        },
        create: {
          userId: session.userId,
          pattern: t.patternKey!,
          description: t.description,
          tags: {
            create: t.tagIds!.map((tagId) => ({ tagId })),
          },
        },
      });
    }
  } catch (err) {
    console.error("[import] Failed to save import rules:", err);
  }

  return NextResponse.json({
    success: true,
    imported: importedCount,
    skipped: skipped.length,
  });
}
