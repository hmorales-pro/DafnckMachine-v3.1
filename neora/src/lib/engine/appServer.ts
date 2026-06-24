import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const ROOT = path.join(process.cwd(), ".neora-workspace");

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export type RunningApp = { url: string; proc: ChildProcess };

async function waitReady(url: string, proc: ChildProcess, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error("Le serveur de l'app s'est arrêté au démarrage.");
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (res.ok || res.status < 500) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Délai dépassé : le serveur de l'app n'a pas démarré.");
}

// Démarre le serveur du projet généré (server.js) sur un port libre.
export async function startApp(id: string): Promise<RunningApp> {
  const dir = path.join(ROOT, id);
  const port = await getFreePort();
  const proc = spawn(process.execPath, ["server.js"], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  try {
    await waitReady(url, proc);
  } catch (e) {
    stopApp(proc);
    throw e;
  }
  return { url, proc };
}

export function stopApp(proc: ChildProcess) {
  try {
    proc.kill("SIGKILL");
  } catch {
    /* déjà arrêté */
  }
}
