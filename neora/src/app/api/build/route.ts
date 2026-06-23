import { NextRequest, NextResponse } from "next/server";
import { runPhase, getPhase, type PhaseId } from "@/lib/engine/pipeline";
import { hasRealKey } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

// Exécute UNE phase du pipeline. Le client enchaîne les phases pour afficher
// la progression en direct et passer les livrables précédents en contexte.
export async function POST(req: NextRequest) {
  try {
    const { idea, phaseId, prior } = (await req.json()) as {
      idea: string;
      phaseId: PhaseId;
      prior: Partial<Record<PhaseId, string>>;
    };

    if (!idea?.trim()) {
      return NextResponse.json({ error: "Décrivez votre idée." }, { status: 400 });
    }
    if (!getPhase(phaseId)) {
      return NextResponse.json({ error: "Phase inconnue." }, { status: 400 });
    }

    const artifact = await runPhase(phaseId, idea.trim(), prior ?? {});
    return NextResponse.json({ artifact, mock: !hasRealKey });
  } catch (err) {
    console.error("Erreur /api/build:", err);
    return NextResponse.json(
      { error: "Erreur lors de l'exécution de la phase." },
      { status: 500 }
    );
  }
}
