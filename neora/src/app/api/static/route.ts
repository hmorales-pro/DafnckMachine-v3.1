import { NextRequest, NextResponse } from "next/server";
import { runStaticAnalysis } from "@/lib/engine/staticAnalysis";

export const runtime = "nodejs";
export const maxDuration = 90;

// Porte QA : analyse statique réelle (jscpd + knip) du projet généré.
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string };
    if (!id || !/^proj-[a-z0-9]+$/.test(id)) {
      return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
    }
    const result = await runStaticAnalysis(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Erreur /api/static:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur d'analyse statique." },
      { status: 500 }
    );
  }
}
