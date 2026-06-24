import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/store";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur." },
      { status: 500 }
    );
  }
}
