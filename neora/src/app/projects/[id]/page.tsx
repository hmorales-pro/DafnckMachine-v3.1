"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";

type Project = {
  id: string;
  idea: string;
  summary: string;
  templates: string[];
  files: { path: string; content: string }[];
  qa: Record<string, unknown> | null;
  createdAt: string;
};

export default function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "notfound" | "unauth">("loading");
  const [openFile, setOpenFile] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(async (r) => {
        if (r.status === 401) return setStatus("unauth");
        if (!r.ok) return setStatus("notfound");
        const d = await r.json();
        setProject(d.project);
        setOpenFile(d.project.files[0]?.path ?? null);
        setStatus("ok");
      })
      .catch(() => setStatus("notfound"));
  }, [id]);

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <Link href="/projects" className="text-sm text-white/40 transition hover:text-white">
          ← Mes projets
        </Link>

        {status === "loading" && <p className="mt-8 text-white/40">Chargement…</p>}
        {status === "unauth" && (
          <p className="mt-8 text-white/50">
            Connectez-vous pour voir ce projet.{" "}
            <Link href="/login" className="text-violet-300">
              Se connecter
            </Link>
          </p>
        )}
        {status === "notfound" && <p className="mt-8 text-white/50">Projet introuvable.</p>}

        {status === "ok" && project && (
          <>
            <h1 className="mt-4 text-2xl font-bold text-white">{project.idea}</h1>
            <p className="mt-1 text-sm text-white/40">
              {new Date(project.createdAt).toLocaleString("fr-FR")} · {project.files.length} fichier(s)
              {project.templates.length > 0 && ` · templates : ${project.templates.join(", ")}`}
            </p>
            <p className="mt-3 text-sm text-white/60">{project.summary}</p>

            <div className="mt-6 grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-white/30">Fichiers</p>
                <ul className="space-y-1">
                  {project.files.map((f) => (
                    <li key={f.path}>
                      <button
                        onClick={() => setOpenFile(f.path)}
                        className={`w-full truncate rounded px-2 py-1 text-left text-xs transition ${
                          openFile === f.path ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                        }`}
                      >
                        {f.path}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <pre className="max-h-[28rem] overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-white/80">
                {project.files.find((f) => f.path === openFile)?.content ?? "Sélectionnez un fichier."}
              </pre>
            </div>
          </>
        )}
      </main>
    </>
  );
}
