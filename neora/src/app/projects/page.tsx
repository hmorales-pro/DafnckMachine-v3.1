"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Project = {
  id: string;
  idea: string;
  summary: string;
  templates: string[];
  files: { path: string; content: string }[];
  qa: Record<string, unknown> | null;
  createdAt: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [backend, setBackend] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((me) => {
        if (!me.user) {
          setAuthed(false);
          setLoading(false);
          return;
        }
        setAuthed(true);
        setEmail(me.user.email);
        return fetch("/api/projects")
          .then((r) => r.json())
          .then((d) => {
            setProjects(d.projects ?? []);
            setBackend(d.backend ?? "");
          })
          .finally(() => setLoading(false));
      });
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between">
        <Link href="/studio" className="text-sm text-white/40 transition hover:text-white">
          ← Studio
        </Link>
        <div className="flex items-center gap-3">
          {email && <span className="text-xs text-white/40">{email}</span>}
          {backend && (
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/40">
              backend : {backend}
            </span>
          )}
          {authed && (
            <button onClick={logout} className="text-xs text-white/50 transition hover:text-white">
              Déconnexion
            </button>
          )}
        </div>
      </div>

      <h1 className="mt-4 text-3xl font-bold text-white">📁 Mes projets</h1>
      <p className="mt-2 text-white/50">Projets générés et sauvegardés.</p>

      {loading ? (
        <p className="mt-8 text-white/40">Chargement…</p>
      ) : authed === false ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-white/50">Connectez-vous pour voir vos projets.</p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
          >
            Se connecter
          </Link>
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-white/50">Aucun projet sauvegardé pour l&apos;instant.</p>
          <Link
            href="/studio"
            className="mt-4 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
          >
            Créer un projet
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {projects.map((p) => {
            const isOpen = openId === p.id;
            return (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03]">
                <button
                  onClick={() => setOpenId(isOpen ? null : p.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <div>
                    <h3 className="font-medium text-white">{p.idea}</h3>
                    <p className="text-xs text-white/40">
                      {new Date(p.createdAt).toLocaleString("fr-FR")} · {p.files.length} fichier(s)
                      {p.templates.length > 0 && ` · templates : ${p.templates.join(", ")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.qa?.tests === true && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                        tests ✓
                      </span>
                    )}
                    <span className="text-white/30">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-white/10 px-5 py-4">
                    <p className="mb-3 text-sm text-white/60">{p.summary}</p>
                    <ul className="space-y-1">
                      {p.files.map((f) => (
                        <li key={f.path} className="font-mono text-xs text-white/50">
                          {f.path}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
