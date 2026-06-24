import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/lib/agents";
import { generateReply, hasRealKey, type ChatMessage } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, messages } = body as { slug: string; messages: ChatMessage[] };

    const agent = getAgent(slug);
    if (!agent) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Aucun message fourni" }, { status: 400 });
    }

    const reply = await generateReply("chat", agent.systemPrompt, messages);

    return NextResponse.json({ reply, mock: !hasRealKey });
  } catch (err) {
    console.error("Erreur /api/chat:", err);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la génération de la réponse." },
      { status: 500 }
    );
  }
}
