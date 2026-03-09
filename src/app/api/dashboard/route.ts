import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");

  const now = new Date();
  const monthStart = dateFromParam ? new Date(dateFromParam + "T00:00:00.000Z") : startOfMonth(now);
  const monthEnd = (() => {
    if (dateToParam) {
      const d = new Date(dateToParam + "T00:00:00.000Z");
      d.setUTCHours(23, 59, 59, 999);
      return d;
    }
    return endOfMonth(now);
  })();

  const periodMs = monthEnd.getTime() - monthStart.getTime();
  const lastMonthStart = new Date(monthStart.getTime() - periodMs - 1);
  const lastMonthEnd = new Date(monthStart.getTime() - 1);

  const [
    currentIncome,
    currentExpenses,
    lastIncome,
    lastExpenses,
    accounts,
    recentTransactions,
    tagSpendingRows,
    savingsGoals,
    upcomingRecurring,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: session.userId, type: "INCOME", date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: session.userId, type: "EXPENSE", date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: session.userId, type: "INCOME", date: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: session.userId, type: "EXPENSE", date: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { amount: true },
    }),
    prisma.bankAccount.findMany({
      where: { userId: session.userId, isActive: true },
      select: { id: true, name: true, bankName: true, currency: true, currentBalance: true, color: true, icon: true },
    }),
    prisma.transaction.findMany({
      where: { userId: session.userId, date: { gte: monthStart, lte: monthEnd } },
      include: {
        bankAccount: { select: { name: true, currency: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.transactionTag.findMany({
      where: {
        transaction: {
          userId: session.userId,
          type: "EXPENSE",
          date: { gte: monthStart, lte: monthEnd },
        },
      },
      include: {
        tag: true,
        transaction: { select: { amount: true } },
      },
    }),
    prisma.savingsGoal.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.recurringRule.findMany({
      where: { userId: session.userId, isActive: true },
      orderBy: { nextOccurrence: "asc" },
      take: 5,
    }),
  ]);

  const tagTotals: Record<string, { tag: { id: string; name: string; color: string }; amount: number }> = {};
  for (const row of tagSpendingRows) {
    const id = row.tag.id;
    if (!tagTotals[id]) {
      tagTotals[id] = { tag: { id: row.tag.id, name: row.tag.name, color: row.tag.color }, amount: 0 };
    }
    tagTotals[id].amount += row.transaction.amount;
  }

  const spendingData = Object.values(tagTotals).sort((a, b) => b.amount - a.amount);

  const monthRanges = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(now, 11 - i);
    return { date, start: startOfMonth(date), end: endOfMonth(date) };
  });

  const trendStart = monthRanges[0].start;
  const trendEnd = monthRanges[11].end;
  const trendTx = await prisma.transaction.findMany({
    where: {
      userId: session.userId,
      type: { in: ["INCOME", "EXPENSE"] },
      date: { gte: trendStart, lte: trendEnd },
    },
    select: { date: true, amount: true, type: true },
  });

  const monthlyTrend = monthRanges.map(({ date, start, end }) => {
    let income = 0;
    let expenses = 0;
    for (const tx of trendTx) {
      const d = new Date(tx.date);
      if (d >= start && d <= end) {
        if (tx.type === "INCOME") income += tx.amount;
        else expenses += tx.amount;
      }
    }
    return { month: format(date, "MMM"), income, expenses };
  });

  const totalIncome = currentIncome._sum.amount ?? 0;
  const totalExpenses = currentExpenses._sum.amount ?? 0;
  const prevIncome = lastIncome._sum.amount ?? 0;
  const prevExpenses = lastExpenses._sum.amount ?? 0;

  return NextResponse.json({
    summary: {
      totalIncome,
      totalExpenses,
      netSavings: totalIncome - totalExpenses,
      incomeTrend: prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : undefined,
      expensesTrend: prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : undefined,
    },
    accounts,
    recentTransactions,
    spendingByTag: spendingData,
    monthlyTrend,
    savingsGoals,
    upcomingRecurring,
  });
}
