import { getClient, hasRealKey, MODEL } from "@/lib/anthropic";
import type { Anthropic } from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Générateur de code : transforme les livrables du pipeline en VRAIS fichiers
// exécutables (et pas seulement du markdown). Le projet généré inclut au moins
// un test unitaire, ce qui permet à la porte QA de l'exécuter réellement.
// ─────────────────────────────────────────────────────────────────────────────

export type GeneratedFile = { path: string; content: string };
export type GeneratedProject = {
  files: GeneratedFile[];
  summary: string;
  testCommand: string;
};

const SYSTEM =
  "Tu es l'agent de génération de code de Néora (dérivé de coding-agent de DafnckMachine). " +
  "Tu génères un projet Node.js minimal mais RÉELLEMENT EXÉCUTABLE et TESTABLE, sans dépendances externes " +
  "(utilise uniquement les modules natifs Node et le runner de test natif `node:test`). " +
  "Le projet doit contenir : un package.json (\"type\":\"module\", script test = \"node --test\"), " +
  "au moins un module de logique métier et au moins un fichier de test `*.test.js` qui passe. " +
  "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format : " +
  '{"summary": string, "testCommand": "node --test", "files": [{"path": string, "content": string}]}. ' +
  "Les chemins sont relatifs (jamais absolus, jamais de \"..\").";

export async function generateProject(
  idea: string,
  prior: Record<string, string>
): Promise<GeneratedProject> {
  const client = getClient();
  if (!hasRealKey || !client) return mockProject(idea);

  const context = Object.entries(prior)
    .map(([k, v]) => `### ${k}\n${v}`)
    .join("\n\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Idée : "${idea}".\n\nLivrables de conception :\n${context}\n\n` +
          `Génère le projet Node.js exécutable correspondant au cœur métier.`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseProject(text);
}

function parseProject(text: string): GeneratedProject {
  // Extrait le premier objet JSON de la réponse.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Réponse de génération non parsable.");
  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<GeneratedProject>;
  if (!parsed.files?.length) throw new Error("Aucun fichier généré.");
  return {
    summary: parsed.summary ?? "Projet généré.",
    testCommand: parsed.testCommand ?? "node --test",
    files: parsed.files,
  };
}

// Projet de démo (mode sans clé) : réellement exécutable, avec un test qui passe.
function mockProject(idea: string): GeneratedProject {
  return {
    summary: `Cœur métier généré pour : ${idea}. Module de calcul de facturation + tests unitaires natifs.`,
    testCommand: "node --test",
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "neora-generated",
            version: "0.1.0",
            type: "module",
            scripts: { test: "node --test" },
          },
          null,
          2
        ),
      },
      {
        path: "src/invoice.js",
        content: `// Cœur métier généré par Néora.
// Calcule le total d'une facture (HT, TVA, TTC).

export function lineTotal(item) {
  if (item.quantity < 0 || item.unitPrice < 0) {
    throw new Error("Quantité et prix doivent être positifs");
  }
  return item.quantity * item.unitPrice;
}

export function computeInvoice(items, vatRate = 0.2) {
  const ht = items.reduce((sum, it) => sum + lineTotal(it), 0);
  const tva = +(ht * vatRate).toFixed(2);
  const ttc = +(ht + tva).toFixed(2);
  return { ht: +ht.toFixed(2), tva, ttc };
}
`,
      },
      {
        path: "src/invoice.test.js",
        content: `import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInvoice, lineTotal } from "./invoice.js";

test("lineTotal multiplie quantité et prix", () => {
  assert.equal(lineTotal({ quantity: 3, unitPrice: 10 }), 30);
});

test("computeInvoice calcule HT, TVA et TTC", () => {
  const r = computeInvoice([{ quantity: 2, unitPrice: 50 }]);
  assert.deepEqual(r, { ht: 100, tva: 20, ttc: 120 });
});

test("lineTotal rejette les valeurs négatives", () => {
  assert.throws(() => lineTotal({ quantity: -1, unitPrice: 10 }));
});
`,
      },
      {
        path: "README.md",
        content: `# Projet généré par Néora\n\nIdée : ${idea}\n\n## Lancer les tests\n\n\`\`\`bash\nnode --test\n\`\`\`\n`,
      },
    ],
  };
}
