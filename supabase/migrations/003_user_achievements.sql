-- Conquistas (achievements) por usuário.
-- Roda no SQL Editor do Supabase.

create table if not exists public.user_achievements (
  user_id uuid references public.profiles(id) on delete cascade,
  code text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

create index if not exists ua_user_idx on public.user_achievements(user_id);

alter table public.user_achievements enable row level security;

drop policy if exists "ua_read_own"  on public.user_achievements;
drop policy if exists "ua_write_own" on public.user_achievements;

create policy "ua_read_own"
  on public.user_achievements
  for select
  using (auth.uid() = user_id);

create policy "ua_write_own"
  on public.user_achievements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
