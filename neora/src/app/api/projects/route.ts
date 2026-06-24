import { NextRequest, NextResponse } from "next/server";
import { saveProject, listProjects, usingSupabase } from "@/lib/db/store";

export const runtime = "nodejs";

// Utilisateur de démo tant que l'auth Supabase n'est pas branchée.
const DEMO_USER = "00000000-0000-0000-0000-000000000000";

export async function GET() {
  try {
    const projects = await listProjects(DEMO_USER);
    return NextResponse.json({ projects, backend: usingSupabase ? "supabase" : "local" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur de lecture." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      idea: string;
      summary?: string;
      templates?: string[];
      files?: { path: string; content: string }[];
      qa?: Record<string, unknown> | null;
    };
    if (!body.idea?.trim()) {
      return NextResponse.json({ error: "Idée manquante." }, { status: 400 });
    }
    const saved = await saveProject({
      userId: DEMO_USER,
      idea: body.idea.trim(),
      summary: body.summary ?? "",
      templates: body.templates ?? [],
      files: body.files ?? [],
      qa: body.qa ?? null,
    });
    return NextResponse.json({ project: saved, backend: usingSupabase ? "supabase" : "local" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur d'enregistrement." },
      { status: 500 }
    );
  }
}
