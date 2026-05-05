-- Hazirliq v13 single-admin storage setup
-- Run this ONCE in Supabase SQL Editor.
-- This removes the app's dependency on Supabase Auth/session.

create table if not exists public.app_states (
  id text primary key,
  data jsonb not null default '{"groups":[],"students":[],"payments":[],"__updatedAt":"1970-01-01T00:00:00.000Z"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- For this single-admin static app, the anon publishable key needs read/write access.
-- Do NOT put sensitive/private data in this app unless you later add a real backend.
alter table public.app_states disable row level security;

insert into public.app_states (id, data, updated_at)
values ('main', '{"groups":[],"students":[],"payments":[],"__updatedAt":"1970-01-01T00:00:00.000Z"}'::jsonb, now())
on conflict (id) do nothing;
