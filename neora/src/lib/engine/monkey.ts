process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";

import { chromium } from "playwright";
import { startApp, stopApp } from "./appServer";

export type MonkeyResult = {
  interactions: number;
  errors: string[];
  passed: boolean;
};

// Agent « monkey » : interactions aléatoires pour détecter crashs et erreurs JS.
export async function runMonkey(id: string, iterations = 30): Promise<MonkeyResult> {
  const app = await startApp(id);
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  let interactions = 0;
  try {
    const page = await browser.newPage();
    // On retient les vraies erreurs JS (exceptions non gérées), pas le bruit réseau :
    // un 4xx/5xx légitime produit un message « Failed to load resource » qui n'est pas un bug.
    page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      if (text.includes("Failed to load resource")) return;
      errors.push(`console: ${text}`);
    });
    await page.goto(app.url + "/", { waitUntil: "domcontentloaded" });

    for (let i = 0; i < iterations; i++) {
      const handles = await page.$$("button, input, a, select, [onclick]");
      if (handles.length === 0) break;
      const el = handles[Math.floor(Math.random() * handles.length)];
      try {
        const tag = await el.evaluate((n) => (n as HTMLElement).tagName.toLowerCase());
        if (tag === "input") {
          await el.fill(String(Math.floor(Math.random() * 1000) - 200), { timeout: 500 });
        } else {
          await el.click({ timeout: 500 });
        }
        interactions++;
      } catch {
        /* élément non interactif à cet instant : on continue */
      }
    }
  } finally {
    await browser.close();
    stopApp(app.proc);
  }

  return { interactions, errors: [...new Set(errors)], passed: errors.length === 0 };
}
