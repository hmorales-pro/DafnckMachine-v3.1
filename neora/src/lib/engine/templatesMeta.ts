// Métadonnées des templates (client-safe) + auto-sélection par mots-clés.
export type TemplateMeta = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  keywords: string[];
};

export const TEMPLATES_META: TemplateMeta[] = [
  {
    id: "auth",
    name: "Authentification",
    emoji: "🔐",
    description: "Hash de mot de passe (scrypt) + jetons signés (HMAC).",
    keywords: ["auth", "connexion", "compte", "utilisateur", "login", "inscription", "membre"],
  },
  {
    id: "crud",
    name: "CRUD générique",
    emoji: "🗂️",
    description: "Dépôt de données create/read/update/delete, branchable DB.",
    keywords: ["gérer", "gestion", "liste", "crud", "données", "enregistrement", "suivi"],
  },
  {
    id: "payment",
    name: "Paiement",
    emoji: "💳",
    description: "Machine à états de paiement, branchable sur un PSP (Stripe…).",
    keywords: ["paiement", "facture", "facturation", "abonnement", "stripe", "vente", "achat", "commande"],
  },
];

export function autoSelectTemplates(idea: string): string[] {
  const text = idea.toLowerCase();
  return TEMPLATES_META.filter((t) => t.keywords.some((k) => text.includes(k))).map((t) => t.id);
}
