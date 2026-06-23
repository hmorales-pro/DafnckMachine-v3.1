import { notFound } from "next/navigation";
import Link from "next/link";
import { AGENTS, getAgent } from "@/lib/agents";
import ChatClient from "./ChatClient";

// Génère les routes statiques pour chaque agent.
export function generateStaticParams() {
  return AGENTS.map((a) => ({ slug: a.slug }));
}

// Next 16 : params est asynchrone.
export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  return (
    <main className="mx-auto flex h-screen w-full max-w-3xl flex-col px-4">
      {/* En-tête agent */}
      <header className="flex items-center gap-4 border-b border-white/10 py-4">
        <Link
          href="/"
          className="text-white/40 transition hover:text-white"
          aria-label="Retour"
        >
          ←
        </Link>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${agent.accent} text-xl`}
        >
          {agent.emoji}
        </div>
        <div>
          <h1 className="font-semibold text-white">
            {agent.role} <span className="text-white/40">· {agent.name}</span>
          </h1>
          <p className="text-sm text-white/40">{agent.tagline}</p>
        </div>
      </header>

      <ChatClient agent={agent} />
    </main>
  );
}
