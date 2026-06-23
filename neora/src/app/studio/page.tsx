"use client";

import { useState } from "react";
import Link from "next/link";
import { PHASES_META, type PhaseId } from "@/lib/engine/phasesMeta";
import { renderMarkdown } from "@/lib/markdown";

type Status = "pending" | "running" | "done" | "error";
type PhaseState = { status: Status; artifact?: string };

const EXAMPLES = [
  "Un SaaS de facturation simple pour auto-entrepreneurs",
  "Une app de réservation de créneaux pour coachs sportifs",
  "Un outil de suivi de dépenses partagées entre colocataires",
];

export default function StudioPage() {
  const [idea, setIdea] = useState("");
  const [running, setRunning] = useState(false);
  const [mock, setMock] = useState(false);
  const [states, setStates] = useState<Record<PhaseId, PhaseState>>(
    () =>
      Object.fromEntries(PHASES_META.map((p) => [p.id, { status: "pending" }])) as Record<
        PhaseId,
        PhaseState
      >
  );
  const [open, setOpen] = useState<PhaseId | null>(null);

  async function build() {
    const trimmed = idea.trim();
    if (!trimmed || running) return;
    setRunning(true);

    const fresh = Object.fromEntries(
      PHASES_META.map((p) => [p.id, { status: "pending" }])
    ) as Record<PhaseId, PhaseState>;
    setStates(fresh);

    const prior: Partial<Record<PhaseId, string>> = {};

    for (const phase of PHASES_META) {
      setStates((s) => ({ ...s, [phase.id]: { status: "running" } }));
      setOpen(phase.id);
      try {
        const res = await fetch("/api/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idea: trimmed, phaseId: phase.id, prior }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        prior[phase.id] = data.artifact;
        setMock(Boolean(data.mock));
        setStates((s) => ({
          ...s,
          [phase.id]: { status: "done", artifact: data.artifact },
        }));
      } catch {
        setStates((s) => ({ ...s, [phase.id]: { status: "error" } }));
        break;
      }
    }

    setRunning(false);
  }

  function downloadAll() {
    const doc = PHASES_META.filter((p) => states[p.id].artifact)
      .map((p) => `${states[p.id].artifact}`)
      .join("\n\n---\n\n");
    const blob = new Blob([`# Projet généré par Néora\n\n> Idée : ${idea}\n\n${doc}`], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "neora-projet.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasResults = PHASES_META.some((p) => states[p.id].artifact);
  const statusIcon = (s: Status) =>
    s === "done" ? "✓" : s === "running" ? "⏳" : s === "error" ? "✕" : "○";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-white/40 transition hover:text-white">
        ← Néora
      </Link>

      <header className="mt-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
          ⚙️ Moteur DafnckMachine · 6 agents en pipeline
        </div>
        <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
          Studio — transformez une idée en logiciel
        </h1>
        <p className="mt-3 text-white/60">
          Décrivez votre idée de SaaS. Le moteur enchaîne les agents DafnckMachine
          (Vision → PRD → UX → Architecture → Tâches → Code) pour produire un
          dossier de conception complet et exploitable.
        </p>
      </header>

      {/* Saisie de l'idée */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={3}
          disabled={running}
          placeholder="Ex : un SaaS qui automatise les relances de factures impayées pour les TPE…"
          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 disabled:opacity-60"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setIdea(ex)}
              disabled={running}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 transition hover:border-white/25 hover:text-white/80 disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={build}
            disabled={running || !idea.trim()}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-40"
          >
            {running ? "Construction en cours…" : "🚀 Lancer la construction"}
          </button>
          {hasResults && !running && (
            <button
              onClick={downloadAll}
              className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
            >
              ⬇ Télécharger le dossier
            </button>
          )}
        </div>
        {mock && (
          <p className="mt-3 text-xs text-amber-300/80">
            Mode démo : livrables simulés. Ajoutez <code>ANTHROPIC_API_KEY</code> pour
            une génération réelle par Claude.
          </p>
        )}
      </div>

      {/* Pipeline */}
      <div className="mt-8 space-y-3">
        {PHASES_META.map((phase, i) => {
          const st = states[phase.id];
          const isOpen = open === phase.id;
          return (
            <div
              key={phase.id}
              className={`rounded-2xl border transition ${
                st.status === "running"
                  ? "border-violet-500/40 bg-violet-500/5"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : phase.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <span className="text-2xl">{phase.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30">Phase {i + 1}</span>
                    <h3 className="font-semibold text-white">{phase.name}</h3>
                  </div>
                  <p className="text-sm text-white/40">
                    {phase.description}{" "}
                    <span className="text-white/25">· @{phase.agent}</span>
                  </p>
                </div>
                <span
                  className={`text-lg ${
                    st.status === "done"
                      ? "text-emerald-400"
                      : st.status === "running"
                        ? "text-violet-300"
                        : st.status === "error"
                          ? "text-red-400"
                          : "text-white/20"
                  }`}
                >
                  {statusIcon(st.status)}
                </span>
              </button>
              {isOpen && st.artifact && (
                <div
                  className="prose-chat border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/80"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(st.artifact) }}
                />
              )}
              {isOpen && st.status === "running" && (
                <div className="border-t border-white/10 px-5 py-4 text-sm text-white/40">
                  L&apos;agent travaille…
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
