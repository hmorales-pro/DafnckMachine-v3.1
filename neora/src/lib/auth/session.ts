import { promises as fs } from "node:fs";
import path from "node:path";
import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac,
  randomUUID,
} from "node:crypto";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Authentification de Néora (backend local).
// Réutilise le même pattern que le template « auth » que Néora livre à ses
// utilisateurs : hash scrypt + jeton signé HMAC. Stockage local des utilisateurs
// (bascule possible vers Supabase Auth quand configuré).
// ─────────────────────────────────────────────────────────────────────────────

export const COOKIE = "neora_session";
const SECRET = process.env.NEORA_SESSION_SECRET ?? "neora-dev-secret-change-me";
const DIR = path.join(process.cwd(), ".neora-data");
const USERS_FILE = path.join(DIR, "users.json");

type User = { id: string; email: string; passwordHash: string };
export type PublicUser = { id: string; email: string };

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  return candidate.length === original.length && timingSafeEqual(candidate, original);
}

export function createToken(uid: string, expiresInMs = 7 * 24 * 3_600_000): string {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + expiresInMs })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function userIdFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (data.exp < Date.now()) return null;
    return data.uid as string;
  } catch {
    return null;
  }
}

async function readUsers(): Promise<User[]> {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}
async function writeUsers(users: User[]) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

export async function register(email: string, password: string): Promise<PublicUser> {
  const e = email.trim().toLowerCase();
  if (!e.includes("@") || password.length < 6) {
    throw new Error("Email invalide ou mot de passe trop court (6 caractères min).");
  }
  const users = await readUsers();
  if (users.some((u) => u.email === e)) throw new Error("Un compte existe déjà avec cet email.");
  const user: User = { id: randomUUID(), email: e, passwordHash: hashPassword(password) };
  users.push(user);
  await writeUsers(users);
  return { id: user.id, email: user.email };
}

export async function login(email: string, password: string): Promise<PublicUser | null> {
  const e = email.trim().toLowerCase();
  const users = await readUsers();
  const user = users.find((u) => u.email === e);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, email: user.email };
}

export async function getUser(id: string): Promise<PublicUser | null> {
  const users = await readUsers();
  const u = users.find((x) => x.id === id);
  return u ? { id: u.id, email: u.email } : null;
}

// Identifiant utilisateur de la requête (depuis le cookie de session), ou null.
export function userIdFromRequest(req: NextRequest): string | null {
  return userIdFromToken(req.cookies.get(COOKIE)?.value);
}
