import Anthropic from "@anthropic-ai/sdk";

// Le modèle Claude le plus capable pour la génération de livrables métier.
export const MODEL = "claude-opus-4-8";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const apiKey = process.env.ANTHROPIC_API_KEY;
export const hasRealKey = Boolean(apiKey);

const client = apiKey ? new Anthropic({ apiKey }) : null;

/** Renvoie le client Anthropic, ou null en mode démo. */
export function getClient(): Anthropic | null {
  return client;
}

/**
 * Génère une réponse d'agent.
 * - Si une clé ANTHROPIC_API_KEY est configurée : vrai appel à Claude.
 * - Sinon : réponse mock pour que la démo fonctionne de bout en bout.
 */
export async function generateAgentReply(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!client) {
    return mockReply(messages);
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function mockReply(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const question = lastUser?.content ?? "votre demande";
  return (
    `⚙️ **Mode démo (sans clé API)**\n\n` +
    `Voici à quoi ressemblera la réponse de l'agent une fois la clé \`ANTHROPIC_API_KEY\` configurée. ` +
    `J'ai bien reçu votre demande :\n\n> ${question}\n\n` +
    `**Réponse simulée :**\n` +
    `1. Analyse de votre besoin et du contexte de votre activité.\n` +
    `2. Production d'un livrable concret et personnalisé.\n` +
    `3. Suggestions d'actions et de variantes.\n\n` +
    `Pour activer les vraies réponses Claude (Opus 4.8), ajoutez votre clé dans le fichier \`.env.local\` :\n` +
    `\`\`\`\nANTHROPIC_API_KEY=sk-ant-...\n\`\`\`\n` +
    `puis relancez le serveur.`
  );
}
