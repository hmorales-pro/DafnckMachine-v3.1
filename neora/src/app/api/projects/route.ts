import { NextRequest, NextResponse } from "next/server";
import { saveProject, listProjects, usingSupabase } from "@/lib/db/store";
import { userIdFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const projects = await listProjects(userId);
    return NextResponse.json({ projects, backend: usingSupabase ? "supabase" : "local" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur de lecture." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const userId = userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
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
      userId,
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
