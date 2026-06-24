import { startApp, stopApp, type RunningApp } from "./appServer";

// Gère UN serveur d'aperçu vivant à la fois : démarre le projet généré et le
// garde actif pour l'afficher dans une iframe (contrairement aux portes QA qui
// arrêtent le serveur après usage).
let current: { id: string; app: RunningApp } | null = null;

export async function startPreview(id: string): Promise<string> {
  if (current) {
    stopApp(current.app.proc);
    current = null;
  }
  const app = await startApp(id);
  current = { id, app };
  return app.url;
}

export function stopPreview() {
  if (current) {
    stopApp(current.app.proc);
    current = null;
  }
}
