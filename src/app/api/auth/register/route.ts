import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { rateLimit, getIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(getIp(request), "register", 5, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "This email is already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        emailVerified: true,
        bankAccounts: {
          create: [
            {
              name: "Cash",
              accountType: "CASH",
              currency: "RON",
              color: "#10b981",
              icon: "banknote",
              currentBalance: 0,
            },
            {
              name: "Card",
              accountType: "CARD",
              currency: "RON",
              color: "#3b82f6",
              icon: "credit-card",
              currentBalance: 0,
            },
          ],
        },
      },
    });

    const response = NextResponse.json({ success: true }, { status: 201 });

    const session = await getSessionFromRequest(request, response);
    session.userId = user.id;
    session.email = user.email;
    session.name = user.name;
    session.language = user.language as "EN" | "RO";
    session.theme = user.theme as "LIGHT" | "DARK" | "SYSTEM";
    session.isDemo = false;
    session.isDemoSession = false;
    await session.save();

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
