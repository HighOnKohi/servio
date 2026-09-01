-- Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Create the protocols table
create table if not exists public.protocols (
  id         uuid primary key default gen_random_uuid(),
  title      text not null unique,
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists protocols_updated_at on public.protocols;
create trigger protocols_updated_at
  before update on public.protocols
  for each row execute function public.set_updated_at();

-- Row-Level Security: allow authenticated (admin) users to insert/update/delete
-- and allow anyone (anon) to read (so the chatbot can read protocols)
alter table public.protocols enable row level security;

drop policy if exists "Anyone can read protocols" on public.protocols;
create policy "Anyone can read protocols"
  on public.protocols for select
  using (true);

drop policy if exists "Authenticated users can manage protocols" on public.protocols;
create policy "Authenticated users can manage protocols"
  on public.protocols for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
