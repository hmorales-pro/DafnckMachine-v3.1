import { NextRequest, NextResponse } from "next/server";
import { runMonkey } from "@/lib/engine/monkey";

export const runtime = "nodejs";
export const maxDuration = 120;

// Porte QA : monkey testing réel (Playwright) du projet généré.
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string };
    if (!id || !/^proj-[a-z0-9]+$/.test(id)) {
      return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
    }
    const result = await runMonkey(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Erreur /api/monkey:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Monkey." },
      { status: 500 }
    );
  }
}
