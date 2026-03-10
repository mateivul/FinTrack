import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [accounts, transactions, budgets, savingsGoals, tags, recurringRules, importHistory] =
    await Promise.all([
      prisma.bankAccount.findMany({ where: { userId: session.userId } }),
      prisma.transaction.findMany({
        where: { userId: session.userId },
        include: { tags: { include: { tag: { select: { name: true, color: true } } } } },
        orderBy: { date: "desc" },
      }),
      prisma.budget.findMany({
        where: { userId: session.userId },
        include: { tag: { select: { name: true, color: true } } },
      }),
      prisma.savingsGoal.findMany({ where: { userId: session.userId } }),
      prisma.tag.findMany({ where: { userId: session.userId } }),
      prisma.recurringRule.findMany({ where: { userId: session.userId } }),
      prisma.importHistory.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: "1",
    accounts,
    transactions,
    budgets,
    savingsGoals,
    tags,
    recurringRules,
    importHistory,
  };

  const date = new Date().toISOString().split("T")[0];
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fintrack-export-${date}.json"`,
    },
  });
}
