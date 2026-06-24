-- Néora — schéma de persistance des projets générés.
-- À appliquer sur un projet Supabase (via la CLI, le dashboard SQL, ou le MCP apply_migration).

create table if not exists public.neora_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  idea text not null,
  summary text,
  templates jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  qa jsonb,
  created_at timestamptz not null default now()
);

create index if not exists neora_projects_user_idx on public.neora_projects (user_id, created_at desc);

-- Sécurité au niveau ligne : chaque utilisateur ne voit et ne gère que ses projets.
alter table public.neora_projects enable row level security;

drop policy if exists "select own projects" on public.neora_projects;
create policy "select own projects" on public.neora_projects
  for select using (auth.uid() = user_id);

drop policy if exists "insert own projects" on public.neora_projects;
create policy "insert own projects" on public.neora_projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own projects" on public.neora_projects;
create policy "update own projects" on public.neora_projects
  for update using (auth.uid() = user_id);

drop policy if exists "delete own projects" on public.neora_projects;
create policy "delete own projects" on public.neora_projects
  for delete using (auth.uid() = user_id);
