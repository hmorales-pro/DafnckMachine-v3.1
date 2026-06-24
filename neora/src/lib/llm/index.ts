import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { recordUsage, estTokens } from "./usage";

// ─────────────────────────────────────────────────────────────────────────────
// Couche LLM multi-fournisseurs.
// Anthropic via son SDK ; OpenAI / Mistral / Groq / Gemini via l'API compatible
// OpenAI (un seul connecteur). Sélection par variables d'environnement :
//   LLM_PROVIDER = anthropic | openai | mistral | groq | gemini   (défaut anthropic)
//   LLM_MODEL    = override du modèle par défaut du fournisseur
//   <PROVIDER>_API_KEY = la clé correspondante
// ─────────────────────────────────────────────────────────────────────────────

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ProviderId = "anthropic" | "openai" | "mistral" | "groq" | "gemini";

const CONFIG: Record<ProviderId, { keyEnv: string; baseURL?: string; defaultModel: string }> = {
  anthropic: { keyEnv: "ANTHROPIC_API_KEY", defaultModel: "claude-opus-4-8" },
  openai: { keyEnv: "OPENAI_API_KEY", baseURL: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
  mistral: { keyEnv: "MISTRAL_API_KEY", baseURL: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest" },
  groq: { keyEnv: "GROQ_API_KEY", baseURL: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.0-flash",
  },
};

const providerId = ((process.env.LLM_PROVIDER ?? "anthropic").toLowerCase() as ProviderId);
const cfg = CONFIG[providerId] ?? CONFIG.anthropic;
const apiKey =
  process.env[cfg.keyEnv] ?? (providerId === "gemini" ? process.env.GOOGLE_API_KEY : undefined);

export const MODEL = process.env.LLM_MODEL ?? cfg.defaultModel;
export const hasRealKey = Boolean(apiKey);
export const providerInfo = { id: providerId, model: MODEL, hasKey: hasRealKey };

const anthropic = providerId === "anthropic" && apiKey ? new Anthropic({ apiKey }) : null;
const openai =
  providerId !== "anthropic" && apiKey ? new OpenAI({ apiKey, baseURL: cfg.baseURL }) : null;

// Les fournisseurs qui renvoient l'usage tokens en mode streaming.
const STREAM_USAGE = providerId === "openai" || providerId === "groq";

function mock(messages: ChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return (
    `⚙️ **Mode démo (aucune clé LLM configurée)**\n\n` +
    `Demande reçue :\n> ${last?.content ?? "—"}\n\n` +
    `Configurez \`LLM_PROVIDER\` + la clé correspondante pour une vraie génération.`
  );
}

function chunk(text: string, size = 28): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

export async function generateReply(system: string, messages: ChatMessage[]): Promise<string> {
  if (!hasRealKey) return mock(messages);

  if (anthropic) {
    const r = await anthropic.messages.create({ model: MODEL, max_tokens: 4096, system, messages });
    recordUsage(providerId, MODEL, r.usage.input_tokens, r.usage.output_tokens);
    return r.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  const r = await openai!.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: system }, ...messages],
  });
  const u = r.usage;
  recordUsage(
    providerId,
    MODEL,
    u?.prompt_tokens ?? estTokens(system + JSON.stringify(messages)),
    u?.completion_tokens ?? estTokens(r.choices[0]?.message?.content ?? "")
  );
  return r.choices[0]?.message?.content ?? "";
}

export async function* streamReply(system: string, messages: ChatMessage[]): AsyncGenerator<string> {
  if (!hasRealKey) {
    for (const c of chunk(mock(messages))) {
      yield c;
      await new Promise((r) => setTimeout(r, 12));
    }
    return;
  }

  if (anthropic) {
    const stream = anthropic.messages.stream({ model: MODEL, max_tokens: 4096, system, messages });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
    }
    const final = await stream.finalMessage();
    recordUsage(providerId, MODEL, final.usage.input_tokens, final.usage.output_tokens);
    return;
  }

  const stream = await openai!.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: system }, ...messages],
    stream: true,
    ...(STREAM_USAGE ? { stream_options: { include_usage: true } } : {}),
  });
  let out = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
  for await (const part of stream) {
    const d = part.choices[0]?.delta?.content;
    if (d) {
      out += d;
      yield d;
    }
    if (part.usage) usage = part.usage;
  }
  recordUsage(
    providerId,
    MODEL,
    usage?.prompt_tokens ?? estTokens(system + JSON.stringify(messages)),
    usage?.completion_tokens ?? estTokens(out)
  );
}

// Alias de compatibilité.
export const generateAgentReply = generateReply;
