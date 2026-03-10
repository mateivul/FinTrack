import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { budgetSchema } from "@/lib/validations";
import { demoGuard } from "@/lib/demo";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths, subWeeks, subYears } from "date-fns";

function getPeriodRange(period: string, now: Date) {
  switch (period) {
    case "WEEKLY":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "YEARLY":
      return { start: startOfYear(now), end: endOfYear(now) };
    default: 
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function getPreviousPeriodRange(period: string, now: Date) {
  switch (period) {
    case "WEEKLY": {
      const prev = subWeeks(now, 1);
      return { start: startOfWeek(prev, { weekStartsOn: 1 }), end: endOfWeek(prev, { weekStartsOn: 1 }) };
    }
    case "YEARLY": {
      const prev = subYears(now, 1);
      return { start: startOfYear(prev), end: endOfYear(prev) };
    }
    default: { 
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
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

  if (budgets.length === 0) return NextResponse.json({ budgets: [] });

  const allUserIds = new Set<string>([session.userId]);
  const allTagIds = new Set<string>();
  let minDate = now, maxDate = now;

  for (const budget of budgets) {
    for (const sw of budget.sharedWith) allUserIds.add(sw.userId);
    if (budget.tagId) allTagIds.add(budget.tagId);
    const { start, end } = getPeriodRange(budget.period, now);
    if (start < minDate) minDate = start;
    if (end > maxDate) maxDate = end;
    if (budget.rollover) {
      const { start: prevStart } = getPreviousPeriodRange(budget.period, now);
      if (prevStart < minDate) minDate = prevStart;
    }
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      type: "EXPENSE",
      userId: { in: [...allUserIds] },
      date: { gte: minDate, lte: maxDate },
    },
    select: { amount: true, date: true, userId: true, tags: { select: { tagId: true } } },
  });

  const budgetsWithSpending = budgets.map((budget) => {
    const memberIds = new Set([session.userId, ...budget.sharedWith.map((sw) => sw.userId)]);
    const { start, end } = getPeriodRange(budget.period, now);

    let currentSpent = 0;
    for (const tx of transactions) {
      if (!memberIds.has(tx.userId)) continue;
      const d = new Date(tx.date);
      if (d < start || d > end) continue;
      if (budget.tagId && !tx.tags.some((tt) => tt.tagId === budget.tagId)) continue;
      currentSpent += tx.amount;
    }

    let rolloverAmount = 0;
    if (budget.rollover) {
      const { start: prevStart, end: prevEnd } = getPreviousPeriodRange(budget.period, now);
      let prevSpent = 0;
      for (const tx of transactions) {
        if (!memberIds.has(tx.userId)) continue;
        const d = new Date(tx.date);
        if (d < prevStart || d > prevEnd) continue;
        if (budget.tagId && !tx.tags.some((tt) => tt.tagId === budget.tagId)) continue;
        prevSpent += tx.amount;
      }
      rolloverAmount = Math.max(0, budget.amount - prevSpent);
    }

    return { ...budget, currentSpent, rolloverAmount, effectiveAmount: budget.amount + rolloverAmount };
  });

  return NextResponse.json({ budgets: budgetsWithSpending });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoRes = demoGuard(session); if (demoRes) return demoRes;

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
