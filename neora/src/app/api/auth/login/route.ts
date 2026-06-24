import { NextRequest, NextResponse } from "next/server";
import { login, createToken, COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as { email: string; password: string };
    const user = await login(email ?? "", password ?? "");
    if (!user) {
      return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
    }
    const res = NextResponse.json({ user });
    res.cookies.set(COOKIE, createToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Erreur de connexion." }, { status: 400 });
  }
}
