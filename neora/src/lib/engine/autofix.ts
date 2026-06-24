import { generateProject, buildMockProject, type GeneratedFile } from "./codegen";
import { getTemplateFiles } from "./templates";
import { repairProject } from "./repair";
import { writeProject, runTests } from "./workspace";
import { runE2E } from "./e2e";
import { runStaticAnalysis } from "./staticAnalysis";
import { hasRealKey } from "@/lib/anthropic";

// ─────────────────────────────────────────────────────────────────────────────
// Boucle d'auto-réparation — cœur agentique du moteur.
// génère → écrit → fait passer TOUTES les portes QA → (si échec) répare → relance.
// Les portes échouées sont agrégées en un seul rapport envoyé à l'agent de
// réparation, jusqu'à ce que tout passe (ou nombre max de tentatives atteint).
// ─────────────────────────────────────────────────────────────────────────────

export type GateId = "tests" | "e2e" | "static";

export type GateResult = { id: GateId; name: string; passed: boolean; report: string };

export type Attempt = {
  n: number;
  passed: boolean;
  gates: GateResult[];
  repaired?: string[];
};

export type AutofixResult = {
  id: string;
  attempts: Attempt[];
  finalPassed: boolean;
  files: GeneratedFile[];
};

async function runGates(id: string, gateIds: GateId[]): Promise<GateResult[]> {
  const results: GateResult[] = [];

  if (gateIds.includes("tests")) {
    const t = await runTests(id);
    results.push({ id: "tests", name: "Tests unitaires", passed: t.passed, report: t.output });
  }

  if (gateIds.includes("e2e")) {
    const e = await runE2E(id);
    if (!e.available) {
      results.push({ id: "e2e", name: "E2E", passed: true, report: e.reason ?? "non applicable" });
    } else {
      const report = e.steps
        .map((s) => `${s.passed ? "✓" : "✗"} ${s.desc}${s.error ? ` — ${s.error}` : ""}`)
        .join("\n");
      results.push({ id: "e2e", name: "E2E", passed: e.passed, report });
    }
  }

  if (gateIds.includes("static")) {
    const st = await runStaticAnalysis(id);
    const dead = st.deadCode.unusedFiles.length + st.deadCode.unusedExports.length;
    const passed = st.duplication.percentage <= 15 && dead === 0;
    results.push({
      id: "static",
      name: "Analyse statique",
      passed,
      report: `Duplication ${st.duplication.percentage}% · code mort : ${dead}`,
    });
  }

  return results;
}

export async function runAutofix(
  idea: string,
  prior: Record<string, string>,
  templates: string[],
  gateIds: GateId[] = ["tests", "e2e"],
  maxAttempts = 3
): Promise<AutofixResult> {
  // Tentative initiale : buggée en mode démo, normale avec une vraie clé.
  const project = hasRealKey
    ? await generateProject(idea, prior)
    : buildMockProject(idea, true);

  const templateFiles = getTemplateFiles(templates ?? []);
  const existing = new Set(project.files.map((f) => f.path));
  let files = [...project.files, ...templateFiles.filter((f) => !existing.has(f.path))];

  const id = `proj-${Date.now().toString(36)}`;
  const attempts: Attempt[] = [];

  for (let n = 1; n <= maxAttempts; n++) {
    await writeProject(id, files);
    const gates = await runGates(id, gateIds);
    const passed = gates.every((g) => g.passed);
    const attempt: Attempt = { n, passed, gates };
    attempts.push(attempt);

    if (passed || n === maxAttempts) break;

    // Agrège les portes échouées en un rapport unique pour l'agent de réparation.
    const failureReport = gates
      .filter((g) => !g.passed)
      .map((g) => `### Porte « ${g.name} » en échec\n${g.report}`)
      .join("\n\n");

    const fixes = await repairProject(files, failureReport);
    if (fixes.length === 0) break;

    const map = new Map(files.map((f) => [f.path, f]));
    for (const fx of fixes) map.set(fx.path, fx);
    files = [...map.values()];
    attempt.repaired = fixes.map((f) => f.path);
  }

  return {
    id,
    attempts,
    finalPassed: attempts[attempts.length - 1]?.passed ?? false,
    files,
  };
}
