import { NextResponse } from "next/server";
import { getUsage } from "@/lib/llm/usage";
import { providerInfo } from "@/lib/llm";
import { priceFor } from "@/lib/llm/pricing";

export const runtime = "nodejs";

// Usage tokens + coût estimé accumulés depuis le démarrage du serveur.
export async function GET() {
  const usage = getUsage();
  return NextResponse.json({
    provider: providerInfo.id,
    model: providerInfo.model,
    hasKey: providerInfo.hasKey,
    price: priceFor(providerInfo.model),
    usage,
  });
}
