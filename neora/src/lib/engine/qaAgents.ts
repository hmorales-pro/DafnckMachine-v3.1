// Roster des agents Qualité / Vérification (métadonnées client-safe).
// Encode la vision QA complète : ce qui est actif aujourd'hui et ce qui est
// planifié (nécessite de l'infrastructure : navigateur headless, serveur Sonar…).

export type QaStatus = "active" | "planned";

export type QaAgent = {
  id: string;
  name: string;
  agent: string; // agent DafnckMachine de référence
  emoji: string;
  status: QaStatus;
  description: string;
};

export const QA_AGENTS: QaAgent[] = [
  {
    id: "code-review",
    name: "Revue de code",
    agent: "code-reviewer-agent",
    emoji: "🔎",
    status: "active",
    description: "Analyse le code généré : bugs, lisibilité, bonnes pratiques.",
  },
  {
    id: "unit-tests",
    name: "Tests unitaires",
    agent: "functional-tester-agent",
    emoji: "🧪",
    status: "active",
    description: "Exécute réellement les tests unitaires natifs du projet généré.",
  },
  {
    id: "coherence",
    name: "Cohérence & pertinence",
    agent: "system-architect-agent",
    emoji: "🧩",
    status: "active",
    description: "Vérifie l'alignement du code avec le PRD et l'architecture.",
  },
  {
    id: "templates",
    name: "Templates techniques",
    agent: "tech-spec-agent",
    emoji: "🧱",
    status: "active",
    description: "Injection de squelettes éprouvés (auth, paiement, CRUD) pré-validés.",
  },
  {
    id: "e2e-playwright",
    name: "E2E (Playwright)",
    agent: "exploratory-tester-agent",
    emoji: "🎭",
    status: "planned",
    description: "Valide chaque feature dans un navigateur headless. Nécessite Playwright.",
  },
  {
    id: "monkey",
    name: "Monkey testing",
    agent: "exploratory-tester-agent",
    emoji: "🐒",
    status: "planned",
    description: "Interactions aléatoires pour détecter les crashs et états non gérés.",
  },
  {
    id: "static-analysis",
    name: "Analyse statique (jscpd + knip)",
    agent: "efficiency-optimization-agent",
    emoji: "📡",
    status: "active",
    description: "Code mort (knip) et duplications (jscpd) — alternative légère à SonarQube.",
  },
];
