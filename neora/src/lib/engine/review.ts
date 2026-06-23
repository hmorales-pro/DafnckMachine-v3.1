import { generateAgentReply, hasRealKey } from "@/lib/anthropic";
import type { GeneratedFile } from "./codegen";

// Agent de revue de code (dérivé de code-reviewer-agent de DafnckMachine).
const SYSTEM =
  "Tu es l'agent de revue de code de Néora (dérivé de code-reviewer-agent de DafnckMachine). " +
  "Tu analyses le code généré et produis une revue concise en markdown français : " +
  "points forts, problèmes potentiels (bugs, sécurité, lisibilité), et recommandations priorisées. " +
  "Sois précis et actionnable.";

export async function reviewCode(
  idea: string,
  files: GeneratedFile[]
): Promise<string> {
  if (!hasRealKey) {
    return (
      "# Revue de code (mode démo)\n\n" +
      "## Points forts\n- Code modulaire, sans dépendances externes\n- Tests unitaires présents et ciblés\n\n" +
      "## À surveiller\n- Validation des entrées à étendre (formats, valeurs limites)\n- Ajouter la gestion des arrondis monétaires\n\n" +
      "## Recommandations\n1. Ajouter des cas de test sur les montants à 0 et les grands nombres\n2. Documenter le format attendu des items\n\n" +
      "_(Revue simulée — ajoutez ANTHROPIC_API_KEY pour une analyse réelle.)_"
    );
  }
  const bundle = files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n")
    .slice(0, 12000);
  return generateAgentReply(SYSTEM, [
    {
      role: "user",
      content: `Idée : "${idea}".\n\nVoici les fichiers générés. Fais-en la revue :\n\n${bundle}`,
    },
  ]);
}
