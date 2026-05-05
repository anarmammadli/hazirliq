-- Hazirliq Option A: multi-teacher username/code storage
-- Run this in Supabase SQL Editor.
-- This version does NOT use Supabase Auth. Each teacher has one row by username.

create table if not exists public.teacher_states (
  username text primary key,
  name text,
  code text not null,
  data jsonb not null default '{"groups":[],"students":[],"payments":[],"__updatedAt":"1970-01-01T00:00:00.000Z"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Option A is static-app based, so anon publishable key needs read/write access.
-- This is stable and simple, but not high-security. Do not use for sensitive data.
alter table public.teacher_states disable row level security;

-- Optional demo teacher. You can delete/change this row later from admin panel.
insert into public.teacher_states (username, name, code, data, updated_at)
values ('demo', 'Demo müəllim', '123456', '{"groups":[],"students":[],"payments":[],"__updatedAt":"1970-01-01T00:00:00.000Z"}'::jsonb, now())
on conflict (username) do nothing;
