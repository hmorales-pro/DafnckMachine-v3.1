import { costUSD } from "./pricing";

// Accumulateur d'usage tokens + coût estimé, ventilé par modèle (en mémoire).
export type ModelUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  costUSD: number;
};

const byModel: Record<string, ModelUsage> = {};

export function recordUsage(provider: string, model: string, inputTokens: number, outputTokens: number) {
  const key = `${provider}/${model}`;
  const u = (byModel[key] ??= { model: key, inputTokens: 0, outputTokens: 0, calls: 0, costUSD: 0 });
  u.inputTokens += inputTokens;
  u.outputTokens += outputTokens;
  u.calls += 1;
  u.costUSD += costUSD(model, inputTokens, outputTokens);
}

export function getUsage() {
  const models = Object.values(byModel);
  return {
    models,
    totalCostUSD: models.reduce((s, m) => s + m.costUSD, 0),
    totalCalls: models.reduce((s, m) => s + m.calls, 0),
  };
}

export function resetUsage() {
  for (const k of Object.keys(byModel)) delete byModel[k];
}

// Estimation grossière du nombre de tokens (~4 caractères par token).
export function estTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
