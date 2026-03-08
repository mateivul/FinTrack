import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "25");
  const type = searchParams.get("type");
  const accountId = searchParams.get("accountId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const amountMin = searchParams.get("amountMin");
  const amountMax = searchParams.get("amountMax");
  const search = searchParams.get("search");
  const tagId = searchParams.get("tagId");

  const where: Record<string, unknown> = { userId: session.userId };

  if (type && ["INCOME", "EXPENSE", "TRANSFER"].includes(type)) {
    where.type = type;
  }
  if (accountId) where.bankAccountId = accountId;
  if (dateFrom || dateTo) {
    const dateFromParsed = dateFrom ? new Date(dateFrom + "T00:00:00.000Z") : undefined;
    const dateToParsed = (() => {
      if (!dateTo) return undefined;
      const d = new Date(dateTo + "T00:00:00.000Z");
      d.setUTCHours(23, 59, 59, 999);
      return d;
    })();
    where.date = {
      ...(dateFromParsed ? { gte: dateFromParsed } : {}),
      ...(dateToParsed ? { lte: dateToParsed } : {}),
    };
  }
  if (amountMin || amountMax) {
    where.amount = {
      ...(amountMin ? { gte: parseFloat(amountMin) } : {}),
      ...(amountMax ? { lte: parseFloat(amountMax) } : {}),
    };
  }
  if (search) {
    where.description = { contains: search, mode: "insensitive" };
  }
  if (tagId) {
    where.tags = { some: { tagId } };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        bankAccount: { select: { id: true, name: true, currency: true, color: true } },
        toAccount: { select: { id: true, name: true, currency: true, color: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { tags, ...txData } = parsed.data;

  try {
    const account = await prisma.bankAccount.findFirst({
      where: { id: txData.bankAccountId, userId: session.userId },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (txData.type === "TRANSFER" && txData.toAccountId) {
      const toAccount = await prisma.bankAccount.findFirst({
        where: { id: txData.toAccountId, userId: session.userId },
      });
      if (!toAccount) {
        return NextResponse.json({ error: "Destination account not found" }, { status: 404 });
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount: txData.amount,
        type: txData.type,
        date: new Date(txData.date as string),
        description: txData.description ?? "",
        notes: txData.notes || undefined,
        bankAccountId: txData.bankAccountId,
        toAccountId: txData.type === "TRANSFER" ? (txData.toAccountId || null) : null,
        userId: session.userId,
        tags: tags?.length
          ? { create: tags.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: {
        bankAccount: { select: { id: true, name: true, currency: true } },
        toAccount: { select: { id: true, name: true, currency: true } },
        tags: { include: { tag: true } },
      },
    });

    if (txData.type === "TRANSFER") {
      await prisma.bankAccount.update({
        where: { id: txData.bankAccountId },
        data: { currentBalance: { decrement: txData.amount } },
      });
      if (txData.toAccountId) {
        await prisma.bankAccount.update({
          where: { id: txData.toAccountId },
          data: { currentBalance: { increment: txData.amount } },
        });
      }
    } else {
      const balanceDelta = txData.type === "INCOME" ? txData.amount : -txData.amount;
      await prisma.bankAccount.update({
        where: { id: txData.bankAccountId },
        data: { currentBalance: { increment: balanceDelta } },
      });
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Transaction create error:", error);
    const message = error instanceof Error ? error.message : "Failed to create transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
