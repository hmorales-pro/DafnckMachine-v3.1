import { generateReply, hasRealKey } from "@/lib/llm";

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
  "Inclus AUSSI une petite app web testable de bout en bout : `server.js` (serveur node:http qui lit " +
  "process.env.PORT, sert `public/index.html` et expose l'API métier), et `e2e.json` décrivant un " +
  "scénario { url, steps: [ {action:'fill'|'click'|'expectText', selector, value?} ] } qui valide la " +
  "fonctionnalité cœur dans le navigateur. " +
  "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format : " +
  '{"summary": string, "testCommand": "node --test", "files": [{"path": string, "content": string}]}. ' +
  "Les chemins sont relatifs (jamais absolus, jamais de \"..\").";

export async function generateProject(
  idea: string,
  prior: Record<string, string>
): Promise<GeneratedProject> {
  if (!hasRealKey) return mockProject(idea);

  const context = Object.entries(prior)
    .map(([k, v]) => `### ${k}\n${v}`)
    .join("\n\n");

  const text = await generateReply("codegen", SYSTEM, [
    {
      role: "user",
      content:
        `Idée : "${idea}".\n\nLivrables de conception :\n${context}\n\n` +
        `Génère le projet Node.js exécutable correspondant au cœur métier.`,
    },
  ]);

  return parseProject(text);
}

function parseProject(text: string): GeneratedProject {
  // Retire d'éventuels blocs ```json ... ``` puis isole l'objet JSON.
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Le modèle n'a pas renvoyé de JSON exploitable. Début reçu : « ${text.slice(0, 160)}… »`);
  }
  let parsed: Partial<GeneratedProject>;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<GeneratedProject>;
  } catch {
    throw new Error(
      "JSON invalide ou tronqué renvoyé par le modèle (essayez un modèle plus capable pour codegen, " +
        "ou réduisez la taille du projet)."
    );
  }
  if (!parsed.files?.length) throw new Error("Le modèle n'a généré aucun fichier.");
  return {
    summary: parsed.summary ?? "Projet généré.",
    testCommand: parsed.testCommand ?? "node --test",
    files: parsed.files,
  };
}

// Cœur métier de démo, en version correcte et en version buggée (pour la démo
// d'auto-réparation : le bug fait échouer un vrai test, l'agent le corrige).
export const GOOD_INVOICE = `// Cœur métier généré par Néora.
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
`;

// BUG volontaire : la TVA n'est pas appliquée (vatRate = 0) → le test du TTC échoue.
export const BUGGY_INVOICE = GOOD_INVOICE.replace(
  "export function computeInvoice(items, vatRate = 0.2) {",
  "export function computeInvoice(items, vatRate = 0) {"
);

// Projet de démo (mode sans clé) : réellement exécutable, avec un test qui passe.
function mockProject(idea: string, invoiceJs: string = GOOD_INVOICE): GeneratedProject {
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
        content: invoiceJs,
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
        path: "server.js",
        content: `// Serveur minimal (Node natif) servant l'app et l'API de calcul.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { computeInvoice } from "./src/invoice.js";

const port = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/compute") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { quantity, unitPrice } = JSON.parse(body || "{}");
      const result = computeInvoice([{ quantity: Number(quantity), unitPrice: Number(unitPrice) }]);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Entrée invalide" }));
    }
    return;
  }
  const html = await readFile(new URL("./public/index.html", import.meta.url));
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, () => console.log("App sur http://localhost:" + port));
`,
      },
      {
        path: "public/index.html",
        content: `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>Facturation</title></head>
<body>
  <h1>Calcul de facture</h1>
  <label>Quantité <input id="qty" type="number" value="1"></label>
  <label>Prix unitaire <input id="price" type="number" value="0"></label>
  <button id="calc">Calculer</button>
  <p>Total TTC : <span id="result">—</span></p>
  <script>
    document.getElementById("calc").addEventListener("click", async () => {
      const quantity = document.getElementById("qty").value;
      const unitPrice = document.getElementById("price").value;
      const res = await fetch("/api/compute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity, unitPrice }),
      });
      const data = await res.json();
      document.getElementById("result").textContent = data.ttc + " €";
    });
  </script>
</body>
</html>
`,
      },
      {
        path: "e2e.json",
        content: JSON.stringify(
          {
            url: "/",
            steps: [
              { action: "fill", selector: "#qty", value: 2 },
              { action: "fill", selector: "#price", value: 50 },
              { action: "click", selector: "#calc" },
              { action: "expectText", selector: "#result", value: "120" },
            ],
          },
          null,
          2
        ),
      },
      {
        path: "README.md",
        content: `# Projet généré par Néora\n\nIdée : ${idea}\n\n## Lancer\n\n\`\`\`bash\nnode --test   # tests unitaires\nnode server.js  # démarrer l'app\n\`\`\`\n`,
      },
    ],
  };
}

// Construit le projet de démo (mode sans clé), en version correcte ou buggée.
export function buildMockProject(idea: string, buggy = false): GeneratedProject {
  return mockProject(idea, buggy ? BUGGY_INVOICE : GOOD_INVOICE);
}
