import { NextRequest, NextResponse } from "next/server";
import { runE2E } from "@/lib/engine/e2e";

export const runtime = "nodejs";
export const maxDuration = 120;

// Porte QA : tests end-to-end réels (Playwright) du projet généré.
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string };
    if (!id || !/^proj-[a-z0-9]+$/.test(id)) {
      return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
    }
    const result = await runE2E(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Erreur /api/e2e:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur E2E." },
      { status: 500 }
    );
  }
}
