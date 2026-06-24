import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import NavBar from "@/components/NavBar";

export default function Home() {
  return (
    <main className="flex-1">
      <NavBar />
      {/* Hero */}
      <section className="hero-glow border-b border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Propulsé par Claude Opus 4.8
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Votre équipe d&apos;
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              agents IA
            </span>{" "}
            au service de votre entreprise
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
            Néora automatise les tâches opérationnelles des TPE, PME et indépendants.
            Marketing, SEO, prospection, compta, juridique, recrutement, relation client :
            chaque agent est un expert de son domaine.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/studio"
              className="rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-6 py-3 font-medium text-white transition hover:opacity-90"
            >
              🚀 Construire un SaaS
            </Link>
            <a
              href="#agents"
              className="rounded-lg border border-white/15 px-6 py-3 font-medium text-white transition hover:bg-white/5"
            >
              Découvrir l&apos;équipe
            </a>
          </div>
          <p className="mt-4 text-sm text-white/40">
            Studio propulsé par le moteur DafnckMachine — de l&apos;idée au code.
          </p>
        </div>
      </section>

      {/* Agents grid */}
      <section id="agents" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-2 text-2xl font-semibold text-white">L&apos;équipe</h2>
        <p className="mb-8 text-white/50">
          {AGENTS.length} agents spécialisés, disponibles 24/7. Cliquez pour discuter.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((agent) => (
            <Link
              key={agent.slug}
              href={`/agents/${agent.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${agent.accent} text-2xl`}
              >
                {agent.emoji}
              </div>
              <h3 className="text-lg font-semibold text-white">{agent.role}</h3>
              <p className="text-sm text-white/40">
                {agent.name} · {agent.tagline}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                {agent.description}
              </p>
              <span className="mt-4 inline-block text-sm font-medium text-violet-300 opacity-0 transition group-hover:opacity-100">
                Discuter avec {agent.name} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-white/30">
          Néora — démo d&apos;alternative à Limova · Construit avec Next.js & Claude
        </div>
      </footer>
    </main>
  );
}
