-- Run this in Supabase SQL Editor if save still fails.
-- It recreates the table and policies safely.
create table if not exists public.user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"groups":[],"students":[],"payments":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_states enable row level security;

drop policy if exists "Users can view own state" on public.user_states;
drop policy if exists "Users can insert own state" on public.user_states;
drop policy if exists "Users can update own state" on public.user_states;
drop policy if exists "Users can delete own state" on public.user_states;

create policy "Users can view own state"
on public.user_states
for select
using (auth.uid() = user_id);

create policy "Users can insert own state"
on public.user_states
for insert
with check (auth.uid() = user_id);

create policy "Users can update own state"
on public.user_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own state"
on public.user_states
for delete
using (auth.uid() = user_id);
