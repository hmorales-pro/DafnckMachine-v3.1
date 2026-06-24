// Prix indicatifs (USD pour 1 million de tokens), entrée / sortie.
// ⚠️ Ordre de grandeur — révision 2026-06. Les tarifs évoluent : vérifiez
// toujours les pages officielles avant de vous engager.
export type Price = { input: number; output: number; label: string };

export const PRICING: Record<string, Price> = {
  // Anthropic
  "claude-opus-4-8": { input: 15, output: 75, label: "Anthropic · Claude Opus 4.8" },
  "claude-sonnet-4-6": { input: 3, output: 15, label: "Anthropic · Claude Sonnet 4.6" },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4, label: "Anthropic · Claude Haiku 4.5" },
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10, label: "OpenAI · GPT-4o" },
  "gpt-4o-mini": { input: 0.15, output: 0.6, label: "OpenAI · GPT-4o mini" },
  // Mistral
  "mistral-large-latest": { input: 2, output: 6, label: "Mistral · Large" },
  "codestral-latest": { input: 0.3, output: 0.9, label: "Mistral · Codestral" },
  // Groq
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79, label: "Groq · Llama 3.3 70B" },
  // Google Gemini
  "gemini-2.0-flash": { input: 0.1, output: 0.4, label: "Google · Gemini 2.0 Flash" },
  "gemini-1.5-pro": { input: 1.25, output: 5, label: "Google · Gemini 1.5 Pro" },
};

export function priceFor(model: string): Price | null {
  return PRICING[model] ?? null;
}

export function costUSD(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
}
