import { generateAgentReply, hasRealKey, getClient, MODEL } from "@/lib/anthropic";

// ─────────────────────────────────────────────────────────────────────────────
// Moteur de production logicielle de Néora.
//
// Reprend la méthodologie DafnckMachine (agents spécialisés + workflow en phases)
// et lui ajoute ce qui lui manquait : un VRAI moteur d'exécution. Chaque phase
// est pilotée par un "builder agent" (dérivé d'un agent DafnckMachine) et reçoit
// en contexte les livrables des phases précédentes.
// ─────────────────────────────────────────────────────────────────────────────

export type PhaseId =
  | "vision"
  | "prd"
  | "ux"
  | "architecture"
  | "tasks"
  | "blueprint";

export type Phase = {
  id: PhaseId;
  name: string;
  /** Agent DafnckMachine correspondant. */
  agent: string;
  emoji: string;
  description: string;
  system: string;
  /** Phases dont les livrables alimentent celle-ci. */
  inputs: PhaseId[];
  user: (idea: string, prior: Partial<Record<PhaseId, string>>) => string;
  mock: (idea: string) => string;
};

function ctx(prior: Partial<Record<PhaseId, string>>, ids: PhaseId[]): string {
  const parts = ids
    .map((id) => (prior[id] ? `### Livrable « ${PHASE_LABEL[id]} »\n${prior[id]}` : null))
    .filter(Boolean);
  return parts.length ? `\n\nContexte issu des phases précédentes :\n${parts.join("\n\n")}` : "";
}

const PHASE_LABEL: Record<PhaseId, string> = {
  vision: "Vision",
  prd: "PRD",
  ux: "UX / UI",
  architecture: "Architecture",
  tasks: "Plan de tâches",
  blueprint: "Blueprint de code",
};

export const PIPELINE: Phase[] = [
  {
    id: "vision",
    name: "Vision & Concept",
    agent: "idea-generation-agent · core-concept-agent",
    emoji: "💡",
    description: "Clarifie le problème, la cible et la proposition de valeur.",
    inputs: [],
    system:
      "Tu es l'agent Vision de Néora (dérivé des agents idea-generation et core-concept de DafnckMachine). " +
      "À partir d'une idée brute, tu produis une vision produit claire et concise en français. " +
      "Reste pragmatique et orienté MVP.",
    user: (idea) =>
      `Idée du fournisseur :\n"${idea}"\n\n` +
      `Produis une **Vision produit** en markdown avec ces sections : Problème, Cible (personas), ` +
      `Proposition de valeur, Différenciation, Objectifs du MVP, Indicateurs de succès. Sois concret.`,
    mock: (idea) =>
      `# Vision produit\n\n**Idée :** ${idea}\n\n## Problème\nLa cible perd du temps sur une tâche manuelle et coûteuse.\n\n## Cible\n- Indépendants et TPE (persona principal)\n- PME en croissance (persona secondaire)\n\n## Proposition de valeur\nAutomatiser la tâche en quelques clics, sans expertise technique.\n\n## Objectifs du MVP\n1. Inscription et onboarding < 2 min\n2. Première valeur livrée immédiatement\n3. Rétention à 7 jours > 30%\n\n_(Réponse simulée — ajoutez ANTHROPIC_API_KEY pour la génération réelle.)_`,
  },
  {
    id: "prd",
    name: "Spécifications (PRD)",
    agent: "prd-architect-agent",
    emoji: "📋",
    description: "Liste les fonctionnalités, user stories et le périmètre.",
    inputs: ["vision"],
    system:
      "Tu es l'agent PRD de Néora (dérivé de prd-architect-agent de DafnckMachine). " +
      "Tu transformes une vision en spécifications produit exploitables, en français.",
    user: (idea, prior) =>
      `Rédige le **PRD** (Product Requirements Document) en markdown pour : "${idea}".${ctx(prior, ["vision"])}\n\n` +
      `Sections attendues : Fonctionnalités clés (priorisées MoSCoW), User stories (format "En tant que… je veux… afin de…"), ` +
      `Hors-périmètre du MVP, Critères d'acceptation principaux.`,
    mock: () =>
      `# PRD\n\n## Fonctionnalités (MoSCoW)\n- **Must** : authentification, fonctionnalité cœur, tableau de bord\n- **Should** : historique, export\n- **Could** : intégrations tierces\n- **Won't (MVP)** : application mobile native\n\n## User stories\n- En tant qu'utilisateur, je veux m'inscrire afin d'accéder à mon espace.\n- En tant qu'utilisateur, je veux utiliser la fonctionnalité cœur afin de gagner du temps.\n\n## Critères d'acceptation\n- Inscription fonctionnelle avec email/mot de passe\n- Données persistées par utilisateur\n\n_(Réponse simulée.)_`,
  },
  {
    id: "ux",
    name: "UX / UI",
    agent: "ux-researcher-agent · ui-designer-agent",
    emoji: "🎨",
    description: "Définit les écrans clés, les parcours et le design system.",
    inputs: ["vision", "prd"],
    system:
      "Tu es l'agent UX/UI de Néora (dérivé des agents ux-researcher et ui-designer de DafnckMachine). " +
      "Tu conçois l'expérience et l'interface, en français.",
    user: (idea, prior) =>
      `Conçois l'**UX/UI** en markdown pour : "${idea}".${ctx(prior, ["vision", "prd"])}\n\n` +
      `Sections : Parcours utilisateur principal, Liste des écrans clés (avec leur rôle), Principes de design ` +
      `(palette, ton, composants), Points d'attention accessibilité.`,
    mock: () =>
      `# UX / UI\n\n## Parcours principal\nLanding → Inscription → Onboarding → Tableau de bord → Action cœur\n\n## Écrans clés\n- **Landing** : proposition de valeur + CTA\n- **Dashboard** : accès aux fonctionnalités\n- **Écran d'action** : la tâche cœur\n\n## Design\n- Palette sombre, accents violet/bleu\n- Composants : cartes, modales, formulaires clairs\n\n_(Réponse simulée.)_`,
  },
  {
    id: "architecture",
    name: "Architecture technique",
    agent: "system-architect-agent · tech-spec-agent",
    emoji: "🏗️",
    description: "Stack, modèle de données, API et découpage des composants.",
    inputs: ["prd", "ux"],
    system:
      "Tu es l'agent Architecture de Néora (dérivé des agents system-architect et tech-spec de DafnckMachine). " +
      "Tu définis une architecture technique moderne, pragmatique et déployable, en français. " +
      "Privilégie Next.js, TypeScript, Supabase (Postgres) sauf indication contraire.",
    user: (idea, prior) =>
      `Définis l'**architecture technique** en markdown pour : "${idea}".${ctx(prior, ["prd", "ux"])}\n\n` +
      `Sections : Stack technique justifiée, Modèle de données (tables + champs principaux), ` +
      `Endpoints d'API principaux, Découpage en composants/modules, Stratégie de déploiement.`,
    mock: () =>
      `# Architecture technique\n\n## Stack\n- Frontend : Next.js + TypeScript + Tailwind\n- Backend : Next.js API routes + Supabase\n- DB : PostgreSQL (Supabase)\n- Auth : Supabase Auth\n\n## Modèle de données\n- \`users\` (id, email, created_at)\n- \`projects\` (id, user_id, name, data, created_at)\n\n## API\n- \`POST /api/projects\` — créer\n- \`GET /api/projects\` — lister\n\n_(Réponse simulée.)_`,
  },
  {
    id: "tasks",
    name: "Plan de tâches",
    agent: "task-planning-agent",
    emoji: "✅",
    description: "Découpe le travail en epics et tâches dans l'ordre de build.",
    inputs: ["prd", "architecture"],
    system:
      "Tu es l'agent Planification de Néora (dérivé de task-planning-agent de DafnckMachine). " +
      "Tu produis un plan de tâches actionnable et ordonné, en français.",
    user: (idea, prior) =>
      `Établis le **plan de tâches** en markdown pour : "${idea}".${ctx(prior, ["prd", "architecture"])}\n\n` +
      `Organise en epics, puis en tâches numérotées dans l'ordre de réalisation. Pour chaque tâche : ` +
      `un intitulé clair et une estimation (S/M/L). Termine par le chemin critique.`,
    mock: () =>
      `# Plan de tâches\n\n## Epic 1 — Socle\n1. Initialiser le projet Next.js (S)\n2. Configurer Supabase + Auth (M)\n3. Schéma de base de données (M)\n\n## Epic 2 — Fonctionnalité cœur\n4. UI de l'action principale (M)\n5. API + persistance (M)\n6. Tableau de bord (M)\n\n## Chemin critique\n1 → 2 → 3 → 5 → 4 → 6\n\n_(Réponse simulée.)_`,
  },
  {
    id: "blueprint",
    name: "Blueprint de code",
    agent: "coding-agent",
    emoji: "💻",
    description: "Arborescence du projet et code de départ des fichiers clés.",
    inputs: ["architecture", "tasks"],
    system:
      "Tu es l'agent Code de Néora (dérivé de coding-agent de DafnckMachine). " +
      "Tu produis un blueprint d'implémentation directement exploitable par un développeur ou par Claude Code. " +
      "Tu écris du vrai code (TypeScript/React/SQL), en français pour les explications.",
    user: (idea, prior) =>
      `Produis le **blueprint de code** en markdown pour : "${idea}".${ctx(prior, ["architecture", "tasks"])}\n\n` +
      `Inclure : l'arborescence de fichiers du projet, le schéma SQL de migration, et le code de départ ` +
      `des 2-3 fichiers les plus importants (avec blocs \`\`\`). Reste concis mais fonctionnel.`,
    mock: () =>
      `# Blueprint de code\n\n## Arborescence\n\`\`\`\nsrc/\n  app/\n    page.tsx\n    api/projects/route.ts\n  lib/\n    supabase.ts\n\`\`\`\n\n## Migration SQL\n\`\`\`sql\ncreate table projects (\n  id uuid primary key default gen_random_uuid(),\n  user_id uuid references auth.users,\n  name text not null,\n  created_at timestamptz default now()\n);\n\`\`\`\n\n_(Réponse simulée — ajoutez ANTHROPIC_API_KEY pour du code réel et complet.)_`,
  },
];

export function getPhase(id: string): Phase | undefined {
  return PIPELINE.find((p) => p.id === id);
}

/** Exécute une phase du pipeline et renvoie son livrable (markdown). */
export async function runPhase(
  id: PhaseId,
  idea: string,
  prior: Partial<Record<PhaseId, string>>
): Promise<string> {
  const phase = getPhase(id);
  if (!phase) throw new Error(`Phase inconnue : ${id}`);
  // En mode démo (sans clé), on renvoie un livrable spécifique à la phase.
  if (!hasRealKey) return phase.mock(idea);
  return generateAgentReply(phase.system, [
    { role: "user", content: phase.user(idea, prior) },
  ]);
}

function chunk(text: string, size = 28): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/** Exécute une phase en streaming : yield les fragments de texte au fil de l'eau. */
export async function* runPhaseStream(
  id: PhaseId,
  idea: string,
  prior: Partial<Record<PhaseId, string>>
): AsyncGenerator<string> {
  const phase = getPhase(id);
  if (!phase) throw new Error(`Phase inconnue : ${id}`);

  // Mode démo : on simule le flux en découpant le livrable.
  if (!hasRealKey) {
    for (const c of chunk(phase.mock(idea))) {
      yield c;
      await new Promise((r) => setTimeout(r, 12));
    }
    return;
  }

  const client = getClient();
  if (!client) {
    yield phase.mock(idea);
    return;
  }
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: phase.system,
    messages: [{ role: "user", content: phase.user(idea, prior) }],
  });
  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
      yield ev.delta.text;
    }
  }
}
