import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Fixe la racine du projet (évite l'ambiguïté quand un lockfile parent existe).
  turbopack: { root },
  // Playwright ne doit pas être bundlé : il est exécuté côté serveur (portes QA E2E/Monkey).
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
