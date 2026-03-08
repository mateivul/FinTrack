import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const session = await getSessionFromRequest(request, response);
  await session.destroy();
  return response;
}
