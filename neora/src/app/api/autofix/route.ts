import { NextRequest, NextResponse } from "next/server";
import { runAutofix } from "@/lib/engine/autofix";
import { hasRealKey } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 120;

// Boucle d'auto-réparation : génère, teste, répare et relance jusqu'à réussite.
export async function POST(req: NextRequest) {
  try {
    const { idea, prior, templates } = (await req.json()) as {
      idea: string;
      prior: Record<string, string>;
      templates?: string[];
    };
    if (!idea?.trim()) {
      return NextResponse.json({ error: "Décrivez votre idée." }, { status: 400 });
    }
    const result = await runAutofix(idea.trim(), prior ?? {}, templates ?? []);
    return NextResponse.json({ ...result, mock: !hasRealKey });
  } catch (err) {
    console.error("Erreur /api/autofix:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur d'auto-réparation." },
      { status: 500 }
    );
  }
}
