import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Couche de persistance des projets générés.
// - Si Supabase est configuré (variables d'env) → backend Supabase (Postgres).
// - Sinon → backend local fichier (fonctionne immédiatement, hors Git).
// Même interface dans les deux cas.
// ─────────────────────────────────────────────────────────────────────────────

export type SavedProject = {
  id: string;
  userId: string;
  idea: string;
  summary: string;
  templates: string[];
  files: { path: string; content: string }[];
  qa: Record<string, unknown> | null;
  createdAt: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const usingSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabase) supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  return supabase;
}

const TABLE = "neora_projects";
const LOCAL_DIR = path.join(process.cwd(), ".neora-data");
const LOCAL_FILE = path.join(LOCAL_DIR, "projects.json");

async function readLocal(): Promise<SavedProject[]> {
  try {
    return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
  } catch {
    return [];
  }
}
async function writeLocal(rows: SavedProject[]) {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(rows, null, 2), "utf8");
}

export async function saveProject(
  input: Omit<SavedProject, "id" | "createdAt">
): Promise<SavedProject> {
  const row: SavedProject = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  if (usingSupabase) {
    const { error } = await getSupabase().from(TABLE).insert({
      id: row.id,
      user_id: row.userId,
      idea: row.idea,
      summary: row.summary,
      templates: row.templates,
      files: row.files,
      qa: row.qa,
      created_at: row.createdAt,
    });
    if (error) throw new Error(error.message);
    return row;
  }

  const rows = await readLocal();
  rows.unshift(row);
  await writeLocal(rows);
  return row;
}

export async function listProjects(userId: string): Promise<SavedProject[]> {
  if (usingSupabase) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(fromRow);
  }
  const rows = await readLocal();
  return rows.filter((r) => r.userId === userId);
}

export async function getProject(id: string): Promise<SavedProject | null> {
  if (usingSupabase) {
    const { data, error } = await getSupabase().from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data) : null;
  }
  const rows = await readLocal();
  return rows.find((r) => r.id === id) ?? null;
}

function fromRow(r: Record<string, unknown>): SavedProject {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    idea: r.idea as string,
    summary: r.summary as string,
    templates: (r.templates as string[]) ?? [],
    files: (r.files as SavedProject["files"]) ?? [],
    qa: (r.qa as Record<string, unknown>) ?? null,
    createdAt: r.created_at as string,
  };
}
