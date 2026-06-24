import { NextRequest, NextResponse } from "next/server";
import { generateProject } from "@/lib/engine/codegen";
import { getTemplateFiles } from "@/lib/engine/templates";
import { reviewCode } from "@/lib/engine/review";
import { writeProject } from "@/lib/engine/workspace";
import { hasRealKey } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

// Génère un vrai projet, y injecte les templates choisis, l'écrit sur disque,
// et lance la revue de code.
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

    const project = await generateProject(idea.trim(), prior ?? {});

    // Injection des templates techniques pré-validés (sans écraser le cœur métier).
    const templateFiles = getTemplateFiles(templates ?? []);
    const existing = new Set(project.files.map((f) => f.path));
    const merged = [...project.files, ...templateFiles.filter((f) => !existing.has(f.path))];

    const id = `proj-${Date.now().toString(36)}`;
    await writeProject(id, merged);
    const review = await reviewCode(idea.trim(), merged);

    return NextResponse.json({
      id,
      summary: project.summary,
      files: merged.map((f) => ({ path: f.path, content: f.content })),
      templates: templates ?? [],
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
