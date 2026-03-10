import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { demoGuard } from "@/lib/demo";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoRes = demoGuard(session); if (demoRes) return demoRes;

  const { id } = await params;
  const { pattern, description, tagIds } = await request.json();

  const rule = await prisma.importRule.findFirst({
    where: { id, userId: session.userId },
  });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRule = await tx.importRule.update({
      where: { id },
      data: {
        ...(pattern !== undefined && { pattern }),
        ...(description !== undefined && { description }),
      },
    });
    if (Array.isArray(tagIds)) {
      await tx.importRuleTag.deleteMany({ where: { importRuleId: id } });
      if (tagIds.length > 0) {
        await tx.importRuleTag.createMany({
          data: tagIds.map((tagId: string) => ({ importRuleId: id, tagId })),
        });
      }
    }
    return updatedRule;
  });

  return NextResponse.json({ rule: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoRes = demoGuard(session); if (demoRes) return demoRes;

  const { id } = await params;

  const rule = await prisma.importRule.findFirst({
    where: { id, userId: session.userId },
  });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.importRule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
