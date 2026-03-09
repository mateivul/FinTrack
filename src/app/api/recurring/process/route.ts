import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoUser } from "@/lib/demo";

function getNextOccurrence(date: Date, frequency: string): Date {
  const next = new Date(date);
  switch (frequency) {
    case "DAILY":    next.setUTCDate(next.getUTCDate() + 1); break;
    case "WEEKLY":   next.setUTCDate(next.getUTCDate() + 7); break;
    case "BIWEEKLY": next.setUTCDate(next.getUTCDate() + 14); break;
    case "MONTHLY":  next.setUTCMonth(next.getUTCMonth() + 1); break;
    case "YEARLY":   next.setUTCFullYear(next.getUTCFullYear() + 1); break;
  }
  return next;
}

export async function POST() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isDemoUser(session)) return NextResponse.json({ processed: 0 });

  const now = new Date();

  const dueRules = await prisma.recurringRule.findMany({
    where: {
      userId: session.userId,
      isActive: true,
      nextOccurrence: { lte: now },
    },
    include: { tags: true },
  });

  if (dueRules.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const rule of dueRules) {
    const tagIds = rule.tags.map((t) => t.tagId);
    let occurrence = rule.nextOccurrence;

    while (occurrence <= now) {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            amount: rule.amount,
            type: rule.type,
            date: occurrence,
            description: rule.description,
            bankAccountId: rule.bankAccountId,
            userId: session.userId,
            isRecurring: true,
            recurringRuleId: rule.id,
            source: "RECURRING",
            tags: tagIds.length
              ? { create: tagIds.map((tagId) => ({ tagId })) }
              : undefined,
          },
        });

        const balanceDelta = rule.type === "INCOME" ? rule.amount : -rule.amount;
        await tx.bankAccount.update({
          where: { id: rule.bankAccountId },
          data: { currentBalance: { increment: balanceDelta } },
        });
      });

      processed++;
      occurrence = getNextOccurrence(occurrence, rule.frequency);
    }

    await prisma.recurringRule.update({
      where: { id: rule.id },
      data: { nextOccurrence: occurrence },
    });
  }

  return NextResponse.json({ processed });
}
