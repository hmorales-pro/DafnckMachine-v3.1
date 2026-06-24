import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import type { GeneratedFile } from "./codegen";

// Espace de travail où sont écrits les projets générés (hors Git).
const ROOT = path.join(process.cwd(), ".neora-workspace");

function safeJoin(base: string, rel: string): string {
  const target = path.join(base, rel);
  const normalizedBase = path.resolve(base) + path.sep;
  if (!path.resolve(target).startsWith(normalizedBase)) {
    throw new Error(`Chemin non autorisé : ${rel}`);
  }
  return target;
}

export async function writeProject(id: string, files: GeneratedFile[]): Promise<string> {
  const dir = path.join(ROOT, id);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  for (const f of files) {
    if (f.path.includes("..") || path.isAbsolute(f.path)) {
      throw new Error(`Chemin non autorisé : ${f.path}`);
    }
    const dest = safeJoin(dir, f.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, f.content, "utf8");
  }
  return dir;
}

async function findTestFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (/\.test\.(m?js)$/.test(e.name)) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

export type QaResult = {
  passed: boolean;
  output: string;
  testFiles: number;
};

// Exécute réellement les tests unitaires natifs du projet généré.
export async function runTests(id: string): Promise<QaResult> {
  const dir = path.join(ROOT, id);
  const tests = await findTestFiles(dir);
  if (tests.length === 0) {
    return { passed: false, output: "Aucun fichier de test trouvé.", testFiles: 0 };
  }
  const rel = tests.map((t) => path.relative(dir, t));
  return new Promise<QaResult>((resolve) => {
    execFile(
      process.execPath,
      ["--test", ...rel],
      { cwd: dir, timeout: 20_000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        const output = `${stdout}${stderr}`.trim() || (err ? String(err) : "");
        resolve({
          passed: !err,
          output: output.slice(0, 8000),
          testFiles: tests.length,
        });
      }
    );
  });
}
