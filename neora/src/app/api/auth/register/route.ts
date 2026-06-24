import { NextRequest, NextResponse } from "next/server";
import { register, createToken, COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as { email: string; password: string };
    const user = await register(email ?? "", password ?? "");
    const res = NextResponse.json({ user });
    res.cookies.set(COOKIE, createToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur d'inscription." },
      { status: 400 }
    );
  }
}
