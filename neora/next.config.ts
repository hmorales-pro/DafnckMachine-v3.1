import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright ne doit pas être bundlé : il est exécuté côté serveur (portes QA E2E/Monkey).
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
