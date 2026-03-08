import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { budgetSchema } from "@/lib/validations";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";

function getPeriodRange(period: string, now: Date) {
  switch (period) {
    case "WEEKLY":
      return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) };
    case "YEARLY":
      return { gte: startOfYear(now), lte: endOfYear(now) };
    default: 
      return { gte: startOfMonth(now), lte: endOfMonth(now) };
  }
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  const budgets = await prisma.budget.findMany({
    where: {
      OR: [
        { userId: session.userId },
        { sharedWith: { some: { userId: session.userId } } },
      ],
    },
    include: {
      tag: true,
      sharedWith: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const budgetsWithSpending = await Promise.all(
    budgets.map(async (budget) => {
      const memberIds = [session.userId, ...budget.sharedWith.map((sw) => sw.userId)];
      const dateRange = getPeriodRange(budget.period, now);
      const spent = await prisma.transaction.aggregate({
        where: {
          ...(budget.tagId
            ? { tags: { some: { tagId: budget.tagId } } }
            : {}),
          type: "EXPENSE",
          date: dateRange,
          userId: { in: memberIds },
        },
        _sum: { amount: true },
      });

      return {
        ...budget,
        currentSpent: spent._sum.amount ?? 0,
      };
    })
  );

  return NextResponse.json({ budgets: budgetsWithSpending });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = budgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const budget = await prisma.budget.create({
    data: { ...parsed.data, userId: session.userId },
    include: { tag: true },
  });

  return NextResponse.json({ budget }, { status: 201 });
}
