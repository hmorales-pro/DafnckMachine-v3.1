"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PHASES_META, type PhaseId } from "@/lib/engine/phasesMeta";
import { QA_AGENTS } from "@/lib/engine/qaAgents";
import { TEMPLATES_META, autoSelectTemplates } from "@/lib/engine/templatesMeta";
import { renderMarkdown } from "@/lib/markdown";

type Status = "pending" | "running" | "done" | "error";
type PhaseState = { status: Status; artifact?: string };

type GenFile = { path: string; content: string };
type GenResult = { id: string; summary: string; files: GenFile[]; review: string };
type QaState = { running: boolean; passed?: boolean; output?: string; testFiles?: number };
type Dup = { clones: number; duplicatedLines: number; percentage: number };
type Dead = { unusedFiles: string[]; unusedExports: { file: string; name: string; line: number }[] };
type StaticState = { running: boolean; duplication?: Dup; deadCode?: Dead };
type E2eStep = { desc: string; passed: boolean; error?: string };
type E2eState = { running: boolean; ran?: boolean; available?: boolean; passed?: boolean; steps?: E2eStep[]; reason?: string };
type MonkeyState = { running: boolean; ran?: boolean; interactions?: number; errors?: string[]; passed?: boolean };
type Attempt = { n: number; passed: boolean; output: string; repaired?: string[] };
type FixState = { running: boolean; ran?: boolean; attempts?: Attempt[]; finalPassed?: boolean };

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

  // État de génération de code réel + QA.
  const [gen, setGen] = useState<GenResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [qa, setQa] = useState<QaState>({ running: false });
  const [stat, setStat] = useState<StaticState>({ running: false });
  const [e2e, setE2e] = useState<E2eState>({ running: false });
  const [monkey, setMonkey] = useState<MonkeyState>({ running: false });
  const [fix, setFix] = useState<FixState>({ running: false });

  // Templates : auto-sélection selon l'idée, ajustable par l'utilisateur.
  const [templates, setTemplates] = useState<string[]>([]);
  const [touchedTemplates, setTouchedTemplates] = useState(false);
  useEffect(() => {
    if (!touchedTemplates) setTemplates(autoSelectTemplates(idea));
  }, [idea, touchedTemplates]);

  function toggleTemplate(id: string) {
    setTouchedTemplates(true);
    setTemplates((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  async function build() {
    const trimmed = idea.trim();
    if (!trimmed || running) return;
    setRunning(true);

    const fresh = Object.fromEntries(
      PHASES_META.map((p) => [p.id, { status: "pending" }])
    ) as Record<PhaseId, PhaseState>;
    setStates(fresh);
    setGen(null);
    setQa({ running: false });

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

  async function generate() {
    if (generating || !idea.trim()) return;
    setGenerating(true);
    setGen(null);
    setQa({ running: false });
    setStat({ running: false });
    setE2e({ running: false });
    setMonkey({ running: false });
    const prior: Partial<Record<PhaseId, string>> = {};
    PHASES_META.forEach((p) => {
      if (states[p.id].artifact) prior[p.id] = states[p.id].artifact;
    });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim(), prior, templates }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as GenResult;
      setGen(data);
      setOpenFile(data.files[0]?.path ?? null);
    } catch {
      setGen(null);
    } finally {
      setGenerating(false);
    }
  }

  async function runQa() {
    if (!gen || qa.running) return;
    setQa({ running: true });
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gen.id }),
      });
      const data = await res.json();
      setQa({ running: false, passed: data.passed, output: data.output, testFiles: data.testFiles });
    } catch {
      setQa({ running: false, passed: false, output: "Erreur lors de l'exécution des tests." });
    }
  }

  async function runStatic() {
    if (!gen || stat.running) return;
    setStat({ running: true });
    try {
      const res = await fetch("/api/static", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gen.id }),
      });
      const data = await res.json();
      setStat({ running: false, duplication: data.duplication, deadCode: data.deadCode });
    } catch {
      setStat({ running: false });
    }
  }

  async function runE2e() {
    if (!gen || e2e.running) return;
    setE2e({ running: true });
    try {
      const res = await fetch("/api/e2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gen.id }),
      });
      const data = await res.json();
      setE2e({ running: false, ran: true, available: data.available, passed: data.passed, steps: data.steps, reason: data.reason });
    } catch {
      setE2e({ running: false, ran: true, available: false, reason: "Erreur d'exécution." });
    }
  }

  async function runMonkeyTest() {
    if (!gen || monkey.running) return;
    setMonkey({ running: true });
    try {
      const res = await fetch("/api/monkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gen.id }),
      });
      const data = await res.json();
      setMonkey({ running: false, ran: true, interactions: data.interactions, errors: data.errors, passed: data.passed });
    } catch {
      setMonkey({ running: false, ran: true, passed: false, errors: ["Erreur d'exécution."] });
    }
  }

  async function runAutofix() {
    if (fix.running || !idea.trim()) return;
    setFix({ running: true });
    const prior: Partial<Record<PhaseId, string>> = {};
    PHASES_META.forEach((p) => {
      if (states[p.id].artifact) prior[p.id] = states[p.id].artifact;
    });
    try {
      const res = await fetch("/api/autofix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim(), prior, templates }),
      });
      const data = await res.json();
      setFix({ running: false, ran: true, attempts: data.attempts, finalPassed: data.finalPassed });
    } catch {
      setFix({ running: false, ran: true, attempts: [], finalPassed: false });
    }
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

      {/* Génération de code réel + QA */}
      {states.blueprint.status === "done" && (
        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                ⚙️ Génération & vérification du code
              </h2>
              <p className="mt-1 text-sm text-white/50">
                Le moteur écrit un projet réellement exécutable, le fait relire, puis
                lance les tests.
              </p>
            </div>
            <button
              onClick={generate}
              disabled={generating}
              className="shrink-0 rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {generating ? "Génération…" : gen ? "Régénérer" : "Générer le projet"}
            </button>
          </div>

          {/* Templates techniques pré-validés */}
          <div className="mt-5">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/30">
              Templates techniques pré-validés (auto-suggérés)
            </p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES_META.map((t) => {
                const on = templates.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTemplate(t.id)}
                    title={t.description}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      on
                        ? "border-violet-400/50 bg-violet-500/15 text-white"
                        : "border-white/10 text-white/50 hover:border-white/25 hover:text-white/80"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {t.emoji} {t.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-white/30">
              Squelettes éprouvés livrés avec leurs tests — ils passent la porte QA.
            </p>
          </div>

          {gen && (
            <div className="mt-6 space-y-6">
              <p className="text-sm text-white/60">{gen.summary}</p>

              {/* Arborescence + contenu */}
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-white/30">
                    Fichiers générés
                  </p>
                  <ul className="space-y-1">
                    {gen.files.map((f) => (
                      <li key={f.path}>
                        <button
                          onClick={() => setOpenFile(f.path)}
                          className={`w-full truncate rounded px-2 py-1 text-left text-xs transition ${
                            openFile === f.path
                              ? "bg-white/10 text-white"
                              : "text-white/50 hover:text-white"
                          }`}
                        >
                          {f.path}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-white/80">
                  {gen.files.find((f) => f.path === openFile)?.content ??
                    "Sélectionnez un fichier."}
                </pre>
              </div>

              {/* Revue de code */}
              <details className="rounded-xl border border-white/10 bg-black/20 p-4">
                <summary className="cursor-pointer text-sm font-medium text-white">
                  🔎 Revue de code (code-reviewer-agent)
                </summary>
                <div
                  className="prose-chat mt-3 text-sm text-white/80"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(gen.review) }}
                />
              </details>

              {/* Porte QA : exécution réelle des tests */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      🧪 Porte QA — tests unitaires (exécution réelle)
                    </h3>
                    <p className="text-xs text-white/40">
                      Lance <code>node --test</code> sur le projet généré.
                    </p>
                  </div>
                  <button
                    onClick={runQa}
                    disabled={qa.running}
                    className="shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
                  >
                    {qa.running ? "Exécution…" : "Lancer les tests"}
                  </button>
                </div>
                {qa.passed !== undefined && (
                  <div className="mt-3">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        qa.passed
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {qa.passed
                        ? `✓ Tests réussis (${qa.testFiles} fichier(s))`
                        : "✕ Échec des tests"}
                    </span>
                    {qa.output && (
                      <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-xs leading-relaxed text-white/70">
                        {qa.output}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Porte QA : analyse statique réelle (jscpd + knip) */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      📡 Porte QA — analyse statique (jscpd + knip)
                    </h3>
                    <p className="text-xs text-white/40">
                      Détecte duplications et code mort. Alternative légère à SonarQube.
                    </p>
                  </div>
                  <button
                    onClick={runStatic}
                    disabled={stat.running}
                    className="shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
                  >
                    {stat.running ? "Analyse…" : "Analyser le code"}
                  </button>
                </div>
                {stat.duplication && stat.deadCode && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <p className="text-xs font-medium text-white/70">Duplications (jscpd)</p>
                      <p
                        className={`mt-1 text-2xl font-bold ${
                          stat.duplication.percentage > 10 ? "text-amber-300" : "text-emerald-300"
                        }`}
                      >
                        {stat.duplication.percentage}%
                      </p>
                      <p className="text-xs text-white/40">
                        {stat.duplication.clones} clone(s) · {stat.duplication.duplicatedLines} ligne(s)
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <p className="text-xs font-medium text-white/70">Code mort (knip)</p>
                      <p
                        className={`mt-1 text-2xl font-bold ${
                          stat.deadCode.unusedFiles.length + stat.deadCode.unusedExports.length > 0
                            ? "text-amber-300"
                            : "text-emerald-300"
                        }`}
                      >
                        {stat.deadCode.unusedFiles.length + stat.deadCode.unusedExports.length}
                      </p>
                      <p className="text-xs text-white/40">
                        {stat.deadCode.unusedFiles.length} fichier(s) · {stat.deadCode.unusedExports.length} export(s) inutilisé(s)
                      </p>
                      {stat.deadCode.unusedExports.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-amber-200/80">
                          {stat.deadCode.unusedExports.slice(0, 5).map((e, i) => (
                            <li key={i}>
                              {e.name} <span className="text-white/30">({e.file}:{e.line})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Porte QA : E2E Playwright (vrai navigateur) */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      🎭 Porte QA — E2E (Playwright, vrai navigateur)
                    </h3>
                    <p className="text-xs text-white/40">
                      Démarre l&apos;app générée et joue le scénario <code>e2e.json</code> dans Chromium.
                    </p>
                  </div>
                  <button
                    onClick={runE2e}
                    disabled={e2e.running}
                    className="shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
                  >
                    {e2e.running ? "Exécution…" : "Lancer l'E2E"}
                  </button>
                </div>
                {e2e.ran && e2e.available === false && (
                  <p className="mt-3 text-xs text-white/40">{e2e.reason}</p>
                )}
                {e2e.ran && e2e.available && (
                  <div className="mt-3">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        e2e.passed ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {e2e.passed ? "✓ Scénario validé" : "✕ Échec du scénario"}
                    </span>
                    <ul className="mt-3 space-y-1">
                      {e2e.steps?.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                          <span className={s.passed ? "text-emerald-400" : "text-red-400"}>
                            {s.passed ? "✓" : "✕"}
                          </span>
                          <span>
                            {s.desc}
                            {s.error && <span className="text-red-300/70"> — {s.error}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Porte QA : Monkey testing */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      🐒 Porte QA — Monkey testing
                    </h3>
                    <p className="text-xs text-white/40">
                      Interactions aléatoires dans le navigateur pour détecter crashs et erreurs JS.
                    </p>
                  </div>
                  <button
                    onClick={runMonkeyTest}
                    disabled={monkey.running}
                    className="shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
                  >
                    {monkey.running ? "Singe au travail…" : "Lâcher le singe"}
                  </button>
                </div>
                {monkey.ran && (
                  <div className="mt-3">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        monkey.passed ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {monkey.passed
                        ? `✓ Aucun crash (${monkey.interactions} interactions)`
                        : `✕ ${monkey.errors?.length ?? 0} erreur(s) détectée(s)`}
                    </span>
                    {monkey.errors && monkey.errors.length > 0 && (
                      <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-red-200/80">
                        {monkey.errors.join("\n")}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Roster QA : actifs + planifiés */}
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-3 text-xs uppercase tracking-wide text-white/30">
              Agents qualité du pipeline
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QA_AGENTS.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                >
                  <span className="text-lg">{a.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{a.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          a.status === "active"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/10 text-white/40"
                        }`}
                      >
                        {a.status === "active" ? "actif" : "planifié"}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{a.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Boucle d'auto-réparation (cœur agentique) */}
      {states.blueprint.status === "done" && (
        <section className="mt-8 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                🔁 Boucle d&apos;auto-réparation
              </h2>
              <p className="mt-1 text-sm text-white/50">
                génère → teste → <strong className="text-white/70">répare</strong> → relance,
                jusqu&apos;à ce que les tests passent. (En démo, la 1<sup>re</sup> tentative
                contient un vrai bug que l&apos;agent corrige.)
              </p>
            </div>
            <button
              onClick={runAutofix}
              disabled={fix.running}
              className="shrink-0 rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {fix.running ? "Réparation en cours…" : "Lancer la boucle"}
            </button>
          </div>

          {fix.ran && fix.attempts && (
            <div className="mt-6">
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  fix.finalPassed ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                }`}
              >
                {fix.finalPassed
                  ? `✓ Réparé en ${fix.attempts.length} tentative(s)`
                  : "✕ Non résolu"}
              </span>

              <ol className="mt-4 space-y-3">
                {fix.attempts.map((a) => (
                  <li key={a.n} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${a.passed ? "text-emerald-300" : "text-red-300"}`}
                      >
                        {a.passed ? "✓" : "✕"} Tentative {a.n}
                      </span>
                      {a.repaired && (
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-200">
                          🔧 réparé : {a.repaired.join(", ")}
                        </span>
                      )}
                    </div>
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/50 p-3 text-xs leading-relaxed text-white/60">
                      {a.output.split("\n").filter((l) =>
                        /pass|fail|tests|✔|✖|not ok|ok |Error|Expected|actual/i.test(l)
                      ).slice(0, 10).join("\n") || a.output.slice(0, 400)}
                    </pre>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
