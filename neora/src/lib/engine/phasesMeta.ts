// Métadonnées des phases, sûres à importer côté client (aucune dépendance serveur).
// La logique d'exécution vit dans pipeline.ts (serveur uniquement).
export type PhaseId =
  | "vision"
  | "prd"
  | "ux"
  | "architecture"
  | "tasks"
  | "blueprint";

export type PhaseMeta = {
  id: PhaseId;
  name: string;
  agent: string;
  emoji: string;
  description: string;
};

export const PHASES_META: PhaseMeta[] = [
  {
    id: "vision",
    name: "Vision & Concept",
    agent: "idea-generation · core-concept",
    emoji: "💡",
    description: "Problème, cible et proposition de valeur.",
  },
  {
    id: "prd",
    name: "Spécifications (PRD)",
    agent: "prd-architect",
    emoji: "📋",
    description: "Fonctionnalités, user stories et périmètre.",
  },
  {
    id: "ux",
    name: "UX / UI",
    agent: "ux-researcher · ui-designer",
    emoji: "🎨",
    description: "Écrans clés, parcours et design system.",
  },
  {
    id: "architecture",
    name: "Architecture technique",
    agent: "system-architect · tech-spec",
    emoji: "🏗️",
    description: "Stack, modèle de données et API.",
  },
  {
    id: "tasks",
    name: "Plan de tâches",
    agent: "task-planning",
    emoji: "✅",
    description: "Epics et tâches dans l'ordre de build.",
  },
  {
    id: "blueprint",
    name: "Blueprint de code",
    agent: "coding-agent",
    emoji: "💻",
    description: "Arborescence et code de départ.",
  },
];
