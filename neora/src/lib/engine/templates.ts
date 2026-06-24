import type { GeneratedFile } from "./codegen";

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue de templates techniques PRÉ-VALIDÉS.
// Ce sont des squelettes éprouvés (auth, CRUD, paiement) écrits en Node natif,
// livrés AVEC leurs propres tests. Injectés dans un projet généré, ils passent
// la porte QA (node --test) et fiabilisent fortement le résultat par rapport à
// du code fraîchement généré.
// ─────────────────────────────────────────────────────────────────────────────

const AUTH: GeneratedFile[] = [
  {
    path: "src/auth/auth.js",
    content: `// Template AUTH (pré-validé) — hash de mot de passe + jetons signés (Node natif).
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  return candidate.length === original.length && timingSafeEqual(candidate, original);
}

export function createToken(payload, secret, { expiresInMs = 3_600_000, now = Date.now() } = {}) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now + expiresInMs })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + sig;
}

export function verifyToken(token, secret, { now = Date.now() } = {}) {
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (sig !== expected) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  if (data.exp < now) return null;
  return data;
}
`,
  },
  {
    path: "src/auth/auth.test.js",
    content: `import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, createToken, verifyToken } from "./auth.js";

test("hash/verify mot de passe", () => {
  const h = hashPassword("s3cret");
  assert.ok(verifyPassword("s3cret", h));
  assert.ok(!verifyPassword("mauvais", h));
});

test("jeton signé valide", () => {
  const t = createToken({ uid: 1 }, "k", { now: 1000 });
  assert.equal(verifyToken(t, "k", { now: 2000 }).uid, 1);
});

test("jeton falsifié ou expiré rejeté", () => {
  const t = createToken({ uid: 1 }, "k", { now: 1000, expiresInMs: 10 });
  assert.equal(verifyToken(t + "x", "k", { now: 1005 }), null);
  assert.equal(verifyToken(t, "k", { now: 999_999 }), null);
});
`,
  },
];

const CRUD: GeneratedFile[] = [
  {
    path: "src/crud/repository.js",
    content: `// Template CRUD (pré-validé) — dépôt générique en mémoire, branchable sur une DB.
export function createRepository() {
  const store = new Map();
  let seq = 0;
  return {
    create(data) {
      const id = String(++seq);
      const record = { id, ...data };
      store.set(id, record);
      return record;
    },
    get(id) {
      return store.get(id) ?? null;
    },
    list() {
      return [...store.values()];
    },
    update(id, patch) {
      const current = store.get(id);
      if (!current) return null;
      const next = { ...current, ...patch, id };
      store.set(id, next);
      return next;
    },
    remove(id) {
      return store.delete(id);
    },
    count() {
      return store.size;
    },
  };
}
`,
  },
  {
    path: "src/crud/repository.test.js",
    content: `import { test } from "node:test";
import assert from "node:assert/strict";
import { createRepository } from "./repository.js";

test("cycle CRUD complet", () => {
  const repo = createRepository();
  const a = repo.create({ name: "A" });
  assert.equal(a.id, "1");
  assert.equal(repo.get("1").name, "A");
  assert.equal(repo.update("1", { name: "B" }).name, "B");
  assert.equal(repo.list().length, 1);
  assert.ok(repo.remove("1"));
  assert.equal(repo.count(), 0);
});
`,
  },
];

const PAYMENT: GeneratedFile[] = [
  {
    path: "src/payment/payment.js",
    content: `// Template PAIEMENT (pré-validé) — machine à états d'un paiement.
// Branchable sur Stripe/un PSP : la logique de transitions reste identique.
const TRANSITIONS = {
  created: ["authorized", "canceled"],
  authorized: ["captured", "canceled"],
  captured: ["refunded"],
  canceled: [],
  refunded: [],
};

export function createPayment(amount, currency = "EUR") {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide");
  return { amount, currency, status: "created", events: ["created"] };
}

export function transition(payment, to) {
  const allowed = TRANSITIONS[payment.status] ?? [];
  if (!allowed.includes(to)) {
    throw new Error("Transition interdite : " + payment.status + " → " + to);
  }
  return { ...payment, status: to, events: [...payment.events, to] };
}
`,
  },
  {
    path: "src/payment/payment.test.js",
    content: `import { test } from "node:test";
import assert from "node:assert/strict";
import { createPayment, transition } from "./payment.js";

test("création de paiement", () => {
  assert.equal(createPayment(100).status, "created");
  assert.throws(() => createPayment(0));
});

test("cycle de vie autorisé", () => {
  let p = createPayment(100);
  p = transition(p, "authorized");
  p = transition(p, "captured");
  p = transition(p, "refunded");
  assert.deepEqual(p.events, ["created", "authorized", "captured", "refunded"]);
});

test("transition interdite rejetée", () => {
  const p = createPayment(100);
  assert.throws(() => transition(p, "captured"));
});
`,
  },
];

const CATALOG: Record<string, GeneratedFile[]> = {
  auth: AUTH,
  crud: CRUD,
  payment: PAYMENT,
};

export function getTemplateFiles(ids: string[]): GeneratedFile[] {
  const out: GeneratedFile[] = [];
  for (const id of ids) {
    if (CATALOG[id]) out.push(...CATALOG[id]);
  }
  return out;
}
