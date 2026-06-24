import { NextResponse } from "next/server";
import { getUsage } from "@/lib/llm/usage";
import { getRouting } from "@/lib/llm";

export const runtime = "nodejs";

// Routage par tâche + usage tokens / coût estimé depuis le démarrage du serveur.
export async function GET() {
  const routing = getRouting();
  return NextResponse.json({
    hasKey: routing.hasKey,
    available: routing.available,
    routes: routing.routes,
    usage: getUsage(),
  });
}
