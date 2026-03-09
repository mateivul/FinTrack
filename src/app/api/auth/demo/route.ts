import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, demoSessionOptions } from "@/lib/auth";
import { cloneDemoUser } from "@/lib/demo";
import { rateLimit, getIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const { allowed } = rateLimit(getIp(request), "demo", 20, 5 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let ephemeralUser;
  try {
    ephemeralUser = await cloneDemoUser();
  } catch {
    return NextResponse.json(
      { error: "Demo account not available" },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ success: true });

  const session = await getIronSession<SessionData>(request, response, demoSessionOptions);
  session.userId = ephemeralUser.id;
  session.email = "demo@fintrack.app";
  session.name = ephemeralUser.name;
  session.language = ephemeralUser.language as "EN" | "RO";
  session.theme = ephemeralUser.theme as "LIGHT" | "DARK" | "SYSTEM";
  session.isDemo = false;
  session.isDemoSession = true;
  await session.save();

  return response;
}
