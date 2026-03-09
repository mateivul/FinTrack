import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recurringRuleSchema } from "@/lib/validations";
import { demoGuard } from "@/lib/demo";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await prisma.recurringRule.findMany({
    where: { userId: session.userId },
    include: {
      bankAccount: { select: { id: true, name: true, currency: true, color: true } },
      tags: { include: { tag: true } },
    },
    orderBy: { nextOccurrence: "asc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoRes = demoGuard(session); if (demoRes) return demoRes;

  const body = await request.json();
  const parsed = recurringRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: parsed.data.bankAccountId, userId: session.userId },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const tagIds: string[] = Array.isArray(body.tagIds) ? body.tagIds : [];

  try {
    const rule = await prisma.recurringRule.create({
      data: {
        description: parsed.data.description,
        amount: parsed.data.amount,
        type: parsed.data.type,
        frequency: parsed.data.frequency,
        nextOccurrence: new Date(parsed.data.nextOccurrence),
        bankAccountId: parsed.data.bankAccountId,
        userId: session.userId,
        tags: tagIds.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: {
        bankAccount: { select: { id: true, name: true, currency: true, color: true } },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Recurring rule create error:", error);
    const message = error instanceof Error ? error.message : "Failed to create recurring rule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
