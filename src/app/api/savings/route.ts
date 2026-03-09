import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savingsGoalSchema } from "@/lib/validations";
import { demoGuard } from "@/lib/demo";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await prisma.savingsGoal.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ goals });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoRes = demoGuard(session); if (demoRes) return demoRes;

  const body = await request.json();
  const parsed = savingsGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const goal = await prisma.savingsGoal.create({
    data: {
      ...parsed.data,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
      userId: session.userId,
    },
  });

  return NextResponse.json({ goal }, { status: 201 });
}
