# Néora — Votre équipe d'agents IA 🤖

Démo d'une **alternative à Limova** : une plateforme qui met à disposition une
équipe d'agents IA spécialisés pour automatiser les tâches opérationnelles des
**TPE, PME et indépendants**.

Construit avec **Next.js 16**, **React 19**, **Tailwind CSS 4** et le **SDK
Anthropic** (Claude Opus 4.8).

## ✨ Fonctionnalités

- **7 agents métier spécialisés**, chacun avec son expertise et son prompt système :
  - 📣 Marketing · 🔍 SEO · 🎯 Prospection · 📊 Comptabilité
  - ⚖️ Juridique · 🤝 Recrutement · 💬 Relation client
- **Tableau de bord** présentant toute l'équipe.
- **Interface de chat** par agent, avec suggestions de tâches prêtes à l'emploi.
- **Génération de livrables réels** via Claude (posts, emails, CGV, relances…).
- **Mode démo** intégré : l'app fonctionne sans clé API (réponses simulées),
  et bascule automatiquement sur de vraies réponses Claude dès qu'une clé est
  configurée.

## 🚀 Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseignez votre ANTHROPIC_API_KEY (optionnel)
npm run dev                  # http://localhost:3000
```

Sans clé API, l'application tourne en **mode démo**. Pour activer les vraies
réponses des agents, ajoutez votre clé dans `.env.local` :

```
ANTHROPIC_API_KEY=sk-ant-...
```

## 🏗️ Architecture

```
src/
├── app/
│   ├── page.tsx                     # Tableau de bord (équipe d'agents)
│   ├── agents/[slug]/page.tsx       # Page d'un agent (server component)
│   ├── agents/[slug]/ChatClient.tsx # Interface de chat (client component)
│   └── api/chat/route.ts            # Endpoint de génération
└── lib/
    ├── agents.ts                    # Définition des 7 agents (rôle + prompt)
    └── anthropic.ts                 # Intégration Claude + fallback mock
```

## 🧩 Ajouter un agent

Il suffit d'ajouter une entrée dans `src/lib/agents.ts` (slug, nom, emoji,
prompt système, suggestions). La route, la carte du dashboard et la page de chat
sont générées automatiquement.

## ⚠️ Note

Démo pédagogique. Les agents Comptabilité et Juridique rappellent dans leurs
réponses qu'ils ne remplacent pas un expert-comptable ou un avocat.
