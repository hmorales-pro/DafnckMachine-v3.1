import { NextRequest, NextResponse } from "next/server";
import { userIdFromRequest, getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = userIdFromRequest(req);
  if (!id) return NextResponse.json({ user: null });
  const user = await getUser(id);
  return NextResponse.json({ user });
}
