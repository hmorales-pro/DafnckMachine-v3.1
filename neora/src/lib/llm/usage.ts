import { costUSD } from "./pricing";

// Accumulateur d'usage tokens + coût estimé (en mémoire du process).
// Suffisant pour une estimation de dev « pour moi ». Repart à zéro au redémarrage.
export type UsageTotals = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  costUSD: number;
};

const totals: UsageTotals = {
  provider: "",
  model: "",
  inputTokens: 0,
  outputTokens: 0,
  calls: 0,
  costUSD: 0,
};

export function recordUsage(provider: string, model: string, inputTokens: number, outputTokens: number) {
  totals.provider = provider;
  totals.model = model;
  totals.inputTokens += inputTokens;
  totals.outputTokens += outputTokens;
  totals.calls += 1;
  totals.costUSD += costUSD(model, inputTokens, outputTokens);
}

export function getUsage(): UsageTotals {
  return { ...totals };
}

export function resetUsage() {
  totals.inputTokens = 0;
  totals.outputTokens = 0;
  totals.calls = 0;
  totals.costUSD = 0;
}

// Estimation grossière du nombre de tokens (~4 caractères par token).
export function estTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
