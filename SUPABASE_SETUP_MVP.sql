-- ChildGrowth AI Cloud Save MVP setup
-- Use this first because it is the quickest way to make Test Cloud Save work.
-- Supabase SQL Editor -> New query -> paste all -> Run.

create extension if not exists pgcrypto;

create table if not exists public.family_records (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  app_version text,
  source text,
  created_at timestamptz not null default now()
);

alter table public.family_records enable row level security;

drop policy if exists "Allow anon insert family_records" on public.family_records;

create policy "Allow anon insert family_records"
on public.family_records
for insert
to anon
with check (true);

select pg_notify('pgrst', 'reload schema');
