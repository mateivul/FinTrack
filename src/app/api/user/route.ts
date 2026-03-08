import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  language: z.enum(["EN", "RO"]).optional(),
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (body.currentPassword) {
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const match = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!match) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: parsed.data,
    select: { id: true, email: true, name: true, language: true, theme: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.delete({ where: { id: session.userId } });
  session.destroy();

  return NextResponse.json({ success: true });
}
