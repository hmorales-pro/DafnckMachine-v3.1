import { NextRequest, NextResponse } from "next/server";
import { runTests } from "@/lib/engine/workspace";

export const runtime = "nodejs";
export const maxDuration = 30;

// Porte QA : exécute réellement les tests unitaires du projet généré.
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string };
    if (!id || !/^proj-[a-z0-9]+$/.test(id)) {
      return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
    }
    const result = await runTests(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Erreur /api/qa:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur QA." },
      { status: 500 }
    );
  }
}
