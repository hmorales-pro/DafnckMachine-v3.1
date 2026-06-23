import { NextRequest, NextResponse } from "next/server";
import { generateProject } from "@/lib/engine/codegen";
import { reviewCode } from "@/lib/engine/review";
import { writeProject } from "@/lib/engine/workspace";
import { hasRealKey } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

// Génère un vrai projet, l'écrit sur disque, et lance la revue de code.
export async function POST(req: NextRequest) {
  try {
    const { idea, prior } = (await req.json()) as {
      idea: string;
      prior: Record<string, string>;
    };
    if (!idea?.trim()) {
      return NextResponse.json({ error: "Décrivez votre idée." }, { status: 400 });
    }

    const project = await generateProject(idea.trim(), prior ?? {});
    const id = `proj-${Date.now().toString(36)}`;
    await writeProject(id, project.files);
    const review = await reviewCode(idea.trim(), project.files);

    return NextResponse.json({
      id,
      summary: project.summary,
      files: project.files.map((f) => ({ path: f.path, content: f.content })),
      review,
      mock: !hasRealKey,
    });
  } catch (err) {
    console.error("Erreur /api/generate:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur de génération." },
      { status: 500 }
    );
  }
}
