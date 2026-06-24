import { NextRequest } from "next/server";
import { PIPELINE, runPhaseStream, type PhaseId } from "@/lib/engine/pipeline";
import { hasRealKey } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 120;

// Exécute tout le pipeline en streaming (NDJSON), en threadant le contexte.
export async function POST(req: NextRequest) {
  const { idea } = (await req.json()) as { idea: string };
  if (!idea?.trim()) {
    return new Response(JSON.stringify({ error: "Décrivez votre idée." }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const prior: Partial<Record<PhaseId, string>> = {};
      try {
        for (const phase of PIPELINE) {
          send({ type: "phase-start", id: phase.id, name: phase.name });
          let full = "";
          for await (const delta of runPhaseStream(phase.id, idea.trim(), prior)) {
            full += delta;
            send({ type: "delta", id: phase.id, text: delta });
          }
          prior[phase.id] = full;
          send({ type: "phase-done", id: phase.id, artifact: full });
        }
        send({ type: "done", mock: !hasRealKey });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Erreur" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
