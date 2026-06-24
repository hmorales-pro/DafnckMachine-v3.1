import { NextRequest, NextResponse } from "next/server";
import { startPreview } from "@/lib/engine/preview";

export const runtime = "nodejs";
export const maxDuration = 30;

// Démarre (ou redémarre) le serveur du projet généré et renvoie son URL.
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string };
    if (!id || !/^proj-[a-z0-9]+$/.test(id)) {
      return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
    }
    const url = await startPreview(id);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Impossible de démarrer l'aperçu (le projet n'a peut-être pas de server.js exécutable).",
      },
      { status: 500 }
    );
  }
}
