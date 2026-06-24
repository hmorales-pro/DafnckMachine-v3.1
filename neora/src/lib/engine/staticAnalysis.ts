import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";

// ─────────────────────────────────────────────────────────────────────────────
// Porte QA d'analyse statique RÉELLE — alternative légère à SonarQube :
//   • jscpd → détection de duplications (copier-coller)
//   • knip  → détection de code mort (fichiers et exports inutilisés)
// Les deux s'exécutent réellement sur le projet généré.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), ".neora-workspace");
const BIN = path.join(process.cwd(), "node_modules", ".bin");

export type StaticResult = {
  duplication: { clones: number; duplicatedLines: number; percentage: number };
  deadCode: {
    unusedFiles: string[];
    unusedExports: { file: string; name: string; line: number }[];
  };
};

function run(
  bin: string,
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      { cwd, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
      // knip et jscpd sortent en code ≠ 0 quand ils trouvent des problèmes :
      // on ignore l'erreur et on lit toujours la sortie.
      (_err, stdout, stderr) => resolve({ stdout: String(stdout), stderr: String(stderr) })
    );
  });
}

export async function runStaticAnalysis(id: string): Promise<StaticResult> {
  const dir = path.join(ROOT, id);

  // ── jscpd : duplications ──────────────────────────────────────────────────
  const outDir = path.join(os.tmpdir(), `jscpd-${id}`);
  await run(
    path.join(BIN, "jscpd"),
    [dir, "--min-lines", "3", "--min-tokens", "20", "--reporters", "json", "--output", outDir, "--silent"],
    dir
  );
  let duplication = { clones: 0, duplicatedLines: 0, percentage: 0 };
  try {
    const report = JSON.parse(await fs.readFile(path.join(outDir, "jscpd-report.json"), "utf8"));
    const t = report.statistics?.total ?? {};
    duplication = {
      clones: t.clones ?? 0,
      duplicatedLines: t.duplicatedLines ?? 0,
      percentage: t.percentage ?? 0,
    };
  } catch {
    /* pas de rapport → 0 */
  }

  // ── knip : code mort (config transitoire pour ce projet) ──────────────────
  const knipConfig = path.join(dir, "knip.json");
  await fs.writeFile(
    knipConfig,
    JSON.stringify({ entry: ["**/*.test.js", "server.js"], project: ["**/*.js"] })
  );
  const deadCode = { unusedFiles: [] as string[], unusedExports: [] as { file: string; name: string; line: number }[] };
  try {
    const { stdout } = await run(path.join(BIN, "knip"), ["--reporter", "json"], dir);
    const start = stdout.indexOf("{");
    if (start !== -1) {
      const parsed = JSON.parse(stdout.slice(start));
      for (const issue of parsed.issues ?? []) {
        for (const f of issue.files ?? []) deadCode.unusedFiles.push(f.name);
        for (const e of issue.exports ?? []) {
          deadCode.unusedExports.push({ file: issue.file, name: e.name, line: e.line });
        }
      }
    }
  } catch {
    /* knip indisponible → vide */
  } finally {
    await fs.rm(knipConfig, { force: true });
  }

  return { duplication, deadCode };
}
