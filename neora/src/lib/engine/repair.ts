import { getClient, hasRealKey, MODEL } from "@/lib/anthropic";
import type { Anthropic } from "@anthropic-ai/sdk";
import { GOOD_INVOICE, type GeneratedFile } from "./codegen";

// Agent de réparation (dérivé de debugger-agent de DafnckMachine).
// Reçoit le code et la sortie d'échec des tests, renvoie les fichiers corrigés.
const SYSTEM =
  "Tu es l'agent de réparation de Néora (dérivé de debugger-agent de DafnckMachine). " +
  "On te donne les fichiers d'un projet et la sortie d'échec de ses tests. " +
  "Tu identifies la cause de l'échec et tu renvoies UNIQUEMENT les fichiers CORRIGÉS. " +
  "Ne change que ce qui est nécessaire, sans casser le reste. " +
  'Réponds UNIQUEMENT avec un JSON valide : {"files": [{"path": string, "content": string}]}.';

export async function repairProject(
  files: GeneratedFile[],
  failureOutput: string
): Promise<GeneratedFile[]> {
  const client = getClient();
  if (!hasRealKey || !client) return mockRepair(files);

  const bundle = files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n")
    .slice(0, 14000);

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Les tests échouent. Sortie :\n\n${failureOutput.slice(0, 4000)}\n\n` +
          `Fichiers du projet :\n\n${bundle}\n\nCorrige la cause de l'échec.`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(text.slice(start, end + 1)) as { files?: GeneratedFile[] };
  return parsed.files ?? [];
}

// Réparation simulée (mode démo) : corrige le bug connu de TVA dans invoice.js.
function mockRepair(files: GeneratedFile[]): GeneratedFile[] {
  if (files.some((f) => f.path === "src/invoice.js")) {
    return [{ path: "src/invoice.js", content: GOOD_INVOICE }];
  }
  return [];
}
