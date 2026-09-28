-- Jawda Ads Board: shared storage schema.
-- Run this once in Supabase > SQL editor, then fill in js/config.js.

create table if not exists public.cards (
  board text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (board, id)
);

create table if not exists public.board_settings (
  board text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Live updates for everyone with the board open.
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.board_settings;

-- Access. The simplest setup for a small trusted team is to allow the anon key
-- to read and write. Keep the repository private if you use this, because the
-- anon key sits in js/config.js.
alter table public.cards enable row level security;
alter table public.board_settings enable row level security;

drop policy if exists "team can read cards" on public.cards;
drop policy if exists "team can write cards" on public.cards;
drop policy if exists "team can read settings" on public.board_settings;
drop policy if exists "team can write settings" on public.board_settings;

create policy "team can read cards" on public.cards for select using (true);
create policy "team can write cards" on public.cards for all using (true) with check (true);
create policy "team can read settings" on public.board_settings for select using (true);
create policy "team can write settings" on public.board_settings for all using (true) with check (true);

-- If you later want logins, swap `using (true)` for `using (auth.role() = 'authenticated')`
-- and add Supabase Auth to the page.
