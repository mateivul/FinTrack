import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recurringRuleSchema } from "@/lib/validations";
import { demoGuard } from "@/lib/demo";

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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoRes = demoGuard(session); if (demoRes) return demoRes;

  const { id } = await params;
  const rule = await prisma.recurringRule.findFirst({
    where: { id, userId: session.userId },
    include: { tags: true },
  });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  if ("isActive" in body && Object.keys(body).length === 1) {
    const updated = await prisma.recurringRule.update({
      where: { id },
      data: { isActive: body.isActive },
      include: {
        bankAccount: { select: { id: true, name: true, currency: true, color: true } },
        tags: { include: { tag: true } },
      },
    });
    return NextResponse.json({ rule: updated });
  }

  if (body.action === "run") {
    if (!rule.isActive) {
      return NextResponse.json({ error: "Cannot run a paused rule" }, { status: 400 });
    }
    const tagIds = rule.tags.map((t) => t.tagId);
    const transaction = await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          amount: rule.amount,
          type: rule.type,
          date: new Date(),
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
      await tx.recurringRule.update({
        where: { id: rule.id },
        data: { nextOccurrence: getNextOccurrence(rule.nextOccurrence, rule.frequency) },
      });
      return t;
    });
    return NextResponse.json({ transaction });
  }
  
  const parsed = recurringRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: parsed.data.bankAccountId, userId: session.userId },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const newTagIds: string[] = Array.isArray(body.tagIds) ? body.tagIds : [];

  const updated = await prisma.recurringRule.update({
    where: { id },
    data: {
      description: parsed.data.description,
      amount: parsed.data.amount,
      type: parsed.data.type,
      frequency: parsed.data.frequency,
      nextOccurrence: new Date(parsed.data.nextOccurrence),
      bankAccountId: parsed.data.bankAccountId,
      tags: {
        deleteMany: {},
        create: newTagIds.map((tagId) => ({ tagId })),
      },
    },
    include: {
      bankAccount: { select: { id: true, name: true, currency: true, color: true } },
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json({ rule: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoRes = demoGuard(session); if (demoRes) return demoRes;

  const { id } = await params;
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId: session.userId } });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.recurringRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
