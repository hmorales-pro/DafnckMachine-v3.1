import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/store";
import { userIdFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur." },
      { status: 500 }
    );
  }
}
