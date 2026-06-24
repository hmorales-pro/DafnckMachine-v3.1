import { generateProject, buildMockProject, type GeneratedFile } from "./codegen";
import { getTemplateFiles } from "./templates";
import { repairProject } from "./repair";
import { writeProject, runTests } from "./workspace";
import { hasRealKey } from "@/lib/anthropic";

// ─────────────────────────────────────────────────────────────────────────────
// Boucle d'auto-réparation : c'est le cœur « agentique » du moteur.
// génère → écrit → teste → (si échec) répare → relance, jusqu'à réussite.
// En mode démo, la 1re tentative contient un vrai bug (test qui échoue),
// l'agent le corrige, et la tentative suivante passe pour de vrai.
// ─────────────────────────────────────────────────────────────────────────────

export type Attempt = {
  n: number;
  passed: boolean;
  output: string;
  repaired?: string[];
};

export type AutofixResult = {
  id: string;
  attempts: Attempt[];
  finalPassed: boolean;
  files: GeneratedFile[];
};

export async function runAutofix(
  idea: string,
  prior: Record<string, string>,
  templates: string[],
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
    const qa = await runTests(id);
    const attempt: Attempt = { n, passed: qa.passed, output: qa.output };
    attempts.push(attempt);

    if (qa.passed || n === maxAttempts) break;

    // Échec → on envoie le code + l'erreur à l'agent de réparation.
    const fixes = await repairProject(files, qa.output);
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
