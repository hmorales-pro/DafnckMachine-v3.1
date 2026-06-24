import { chromium } from "playwright";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { startApp, stopApp } from "./appServer";

// Utilise les navigateurs pré-installés du sandbox/Docker s'ils existent ;
// sinon, laisse Playwright utiliser son emplacement par défaut (dev local Mac/Win).
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync("/opt/pw-browsers")) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
}


const ROOT = path.join(process.cwd(), ".neora-workspace");

type Step =
  | { action: "fill"; selector: string; value: string | number }
  | { action: "click"; selector: string }
  | { action: "expectText"; selector: string; value: string | number };

export type E2eResult = {
  available: boolean;
  passed: boolean;
  steps: { desc: string; passed: boolean; error?: string }[];
  reason?: string;
};

function describe(step: Step): string {
  if (step.action === "fill") return `Saisir « ${step.value} » dans ${step.selector}`;
  if (step.action === "click") return `Cliquer sur ${step.selector}`;
  return `Vérifier que ${step.selector} contient « ${step.value} »`;
}

// Exécute le scénario E2E (e2e.json) du projet généré dans un vrai navigateur.
export async function runE2E(id: string): Promise<E2eResult> {
  const dir = path.join(ROOT, id);
  let spec: { url?: string; steps: Step[] };
  try {
    spec = JSON.parse(await fs.readFile(path.join(dir, "e2e.json"), "utf8"));
  } catch {
    return { available: false, passed: false, steps: [], reason: "Aucun scénario e2e.json généré." };
  }

  const app = await startApp(id);
  const browser = await chromium.launch({ headless: true });
  const steps: E2eResult["steps"] = [];
  try {
    const page = await browser.newPage();
    await page.goto(app.url + (spec.url ?? "/"), { waitUntil: "domcontentloaded" });

    for (const step of spec.steps) {
      try {
        if (step.action === "fill") {
          await page.fill(step.selector, String(step.value), { timeout: 3000 });
        } else if (step.action === "click") {
          await page.click(step.selector, { timeout: 3000 });
        } else if (step.action === "expectText") {
          await page.waitForFunction(
            ([sel, val]) => {
              const el = document.querySelector(sel as string);
              return !!el && (el.textContent ?? "").includes(val as string);
            },
            [step.selector, String(step.value)] as [string, string],
            { timeout: 4000 }
          );
        }
        steps.push({ desc: describe(step), passed: true });
      } catch (e) {
        steps.push({ desc: describe(step), passed: false, error: e instanceof Error ? e.message.split("\n")[0] : "échec" });
      }
    }
  } finally {
    await browser.close();
    stopApp(app.proc);
  }

  return { available: true, passed: steps.length > 0 && steps.every((s) => s.passed), steps };
}
