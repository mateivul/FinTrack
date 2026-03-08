import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tagSchema } from "@/lib/validations";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = tagSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.tag.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const tag = await prisma.tag.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ tag });
  } catch {
    return NextResponse.json({ error: "Tag name already exists" }, { status: 409 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.tag.deleteMany({ where: { id, userId: session.userId } });
  return NextResponse.json({ success: true });
}
