import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { recordUsage, estTokens } from "./usage";

// ─────────────────────────────────────────────────────────────────────────────
// Couche LLM multi-fournisseurs avec ROUTAGE PAR TÂCHE.
// On configure plusieurs clés ; le routeur choisit le modèle selon la tâche :
//   - tâches « cheap »  (chat, conception, revue)  → modèle économique
//   - tâches « strong » (génération de code, réparation) → modèle puissant
//
// Variables d'environnement :
//   <PROVIDER>_API_KEY            active un fournisseur
//   LLM_ROUTE_<TASK>=provider[:model]  surcharge la route d'une tâche
//        TASK ∈ CHAT | DESIGN | CODEGEN | REPAIR | REVIEW
//   LLM_PROVIDER (+ LLM_MODEL)    force un fournisseur unique pour tout (legacy)
// ─────────────────────────────────────────────────────────────────────────────

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ProviderId = "anthropic" | "openai" | "mistral" | "groq" | "gemini";
export type Task = "chat" | "design" | "codegen" | "repair" | "review";

type Tier = "cheap" | "strong";
const TASK_TIER: Record<Task, Tier> = {
  chat: "cheap",
  design: "cheap",
  review: "cheap",
  codegen: "strong",
  repair: "strong",
};

type Cfg = { keyEnv: string; altKeyEnv?: string; baseURL?: string; strong: string; cheap: string };
const CONFIG: Record<ProviderId, Cfg> = {
  anthropic: { keyEnv: "ANTHROPIC_API_KEY", strong: "claude-opus-4-8", cheap: "claude-haiku-4-5-20251001" },
  openai: { keyEnv: "OPENAI_API_KEY", baseURL: "https://api.openai.com/v1", strong: "gpt-4o", cheap: "gpt-4o-mini" },
  mistral: { keyEnv: "MISTRAL_API_KEY", baseURL: "https://api.mistral.ai/v1", strong: "mistral-large-latest", cheap: "codestral-latest" },
  groq: { keyEnv: "GROQ_API_KEY", baseURL: "https://api.groq.com/openai/v1", strong: "llama-3.3-70b-versatile", cheap: "llama-3.3-70b-versatile" },
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    altKeyEnv: "GOOGLE_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    strong: "gemini-1.5-pro",
    cheap: "gemini-2.0-flash",
  },
};

// Ordre de préférence : qualité pour les tâches « strong », coût pour « cheap ».
const STRONG_ORDER: ProviderId[] = ["anthropic", "openai", "mistral", "groq", "gemini"];
const CHEAP_ORDER: ProviderId[] = ["gemini", "groq", "mistral", "openai", "anthropic"];

const PROVIDERS = Object.keys(CONFIG) as ProviderId[];

function keyFor(p: ProviderId): string | undefined {
  const c = CONFIG[p];
  return process.env[c.keyEnv] ?? (c.altKeyEnv ? process.env[c.altKeyEnv] : undefined);
}

const available = PROVIDERS.filter((p) => keyFor(p));
export const hasRealKey = available.length > 0;

const clients: Partial<Record<ProviderId, Anthropic | OpenAI>> = {};
function clientFor(p: ProviderId): Anthropic | OpenAI {
  if (!clients[p]) {
    const apiKey = keyFor(p)!;
    clients[p] = p === "anthropic" ? new Anthropic({ apiKey }) : new OpenAI({ apiKey, baseURL: CONFIG[p].baseURL });
  }
  return clients[p]!;
}

function parseOverride(task: Task): { provider: ProviderId; model: string } | null {
  const raw = process.env[`LLM_ROUTE_${task.toUpperCase()}`];
  if (!raw) return null;
  const [provider, model] = raw.split(":") as [ProviderId, string?];
  if (!CONFIG[provider]) return null;
  return { provider, model: model ?? CONFIG[provider][TASK_TIER[task]] };
}

export function resolveRoute(task: Task): { provider: ProviderId; model: string } | null {
  const tier = TASK_TIER[task];

  // 1. Surcharge explicite par tâche.
  const ov = parseOverride(task);
  if (ov && available.includes(ov.provider)) return ov;

  // 2. Mode fournisseur unique forcé (legacy).
  const forced = process.env.LLM_PROVIDER?.toLowerCase() as ProviderId | undefined;
  if (forced && available.includes(forced)) {
    return { provider: forced, model: process.env.LLM_MODEL ?? CONFIG[forced][tier] };
  }

  // 3. Routage automatique selon le tier, parmi les fournisseurs disponibles.
  const order = tier === "strong" ? STRONG_ORDER : CHEAP_ORDER;
  const provider = order.find((p) => available.includes(p));
  if (!provider) return null;
  return { provider, model: CONFIG[provider][tier] };
}

// Récapitulatif du routage (pour l'UI / l'endpoint usage).
export function getRouting() {
  const tasks: Task[] = ["chat", "design", "codegen", "repair", "review"];
  const routes = Object.fromEntries(tasks.map((t) => [t, resolveRoute(t)]));
  return { available, routes, hasKey: hasRealKey };
}

const STREAM_USAGE = (p: ProviderId) => p === "openai" || p === "groq";

function mock(messages: ChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return (
    `⚙️ **Mode démo (aucune clé LLM configurée)**\n\n` +
    `Demande reçue :\n> ${last?.content ?? "—"}\n\n` +
    `Configurez au moins une clé fournisseur pour une vraie génération.`
  );
}

function chunk(text: string, size = 28): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

type Route = { provider: ProviderId; model: string };

// Liste ordonnée de routes candidates : la route résolue d'abord, puis les
// autres fournisseurs disponibles (pour le repli). Si une route est forcée
// (LLM_PROVIDER) ou surchargée (LLM_ROUTE_<TASK>), on ne tente que celle-là.
function candidateRoutes(task: Task): Route[] {
  const primary = resolveRoute(task);
  if (!primary) return [];
  if (process.env[`LLM_ROUTE_${task.toUpperCase()}`] || process.env.LLM_PROVIDER) return [primary];
  const tier = TASK_TIER[task];
  const order = tier === "strong" ? STRONG_ORDER : CHEAP_ORDER;
  return order.filter((p) => available.includes(p)).map((p) => ({ provider: p, model: CONFIG[p][tier] }));
}

function enrich(err: unknown, tried: Route[]): Error {
  const status = (err as { status?: number })?.status;
  const last = tried[tried.length - 1];
  const where = tried.map((r) => `${r.provider}/${r.model}`).join(" → ");
  let hint = "";
  if (status === 429) hint = " — limite de débit ou quota dépassé (vérifiez vos crédits / RPM)";
  else if (status === 401) hint = " — clé API invalide";
  else if (status === 404) hint = " — modèle introuvable (nom de modèle incorrect ?)";
  return new Error(`${status ?? ""} sur ${last.provider}/${last.model}${hint}. Tenté : ${where}`);
}

async function callOnce(route: Route, system: string, messages: ChatMessage[]): Promise<string> {
  const { provider, model } = route;
  const client = clientFor(provider);
  if (client instanceof Anthropic) {
    const r = await client.messages.create({ model, max_tokens: 8192, system, messages });
    recordUsage(provider, model, r.usage.input_tokens, r.usage.output_tokens);
    return r.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
  const r = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: system }, ...messages],
  });
  recordUsage(
    provider,
    model,
    r.usage?.prompt_tokens ?? estTokens(system + JSON.stringify(messages)),
    r.usage?.completion_tokens ?? estTokens(r.choices[0]?.message?.content ?? "")
  );
  return r.choices[0]?.message?.content ?? "";
}

export async function generateReply(task: Task, system: string, messages: ChatMessage[]): Promise<string> {
  const cands = candidateRoutes(task);
  if (!cands.length) return mock(messages);
  let lastErr: unknown;
  for (const route of cands) {
    try {
      return await callOnce(route, system, messages);
    } catch (e) {
      lastErr = e;
    }
  }
  throw enrich(lastErr, cands);
}

async function* streamOnce(route: Route, system: string, messages: ChatMessage[]): AsyncGenerator<string> {
  const { provider, model } = route;
  const client = clientFor(provider);
  if (client instanceof Anthropic) {
    const stream = client.messages.stream({ model, max_tokens: 8192, system, messages });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
    }
    const final = await stream.finalMessage();
    recordUsage(provider, model, final.usage.input_tokens, final.usage.output_tokens);
    return;
  }
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: system }, ...messages],
    stream: true,
    ...(STREAM_USAGE(provider) ? { stream_options: { include_usage: true } } : {}),
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
    provider,
    model,
    usage?.prompt_tokens ?? estTokens(system + JSON.stringify(messages)),
    usage?.completion_tokens ?? estTokens(out)
  );
}

export async function* streamReply(task: Task, system: string, messages: ChatMessage[]): AsyncGenerator<string> {
  const cands = candidateRoutes(task);
  if (!cands.length) {
    for (const c of chunk(mock(messages))) {
      yield c;
      await new Promise((r) => setTimeout(r, 12));
    }
    return;
  }
  let lastErr: unknown;
  for (const route of cands) {
    let yielded = false;
    try {
      for await (const d of streamOnce(route, system, messages)) {
        yielded = true;
        yield d;
      }
      return;
    } catch (e) {
      lastErr = e;
      // Repli impossible si du contenu a déjà été émis (éviterait les doublons).
      if (yielded) throw enrich(e, [route]);
    }
  }
  throw enrich(lastErr, cands);
}
