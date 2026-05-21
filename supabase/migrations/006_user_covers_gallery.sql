-- Galeria de capas por usuário (substitui o profiles.cover_url único).
-- Mantém profiles.cover_url como "capa ativa" (back-compat); este histórico
-- guarda as últimas 10 capas geradas, com FIFO automático.
-- Roda no SQL Editor do Supabase.

-- gen_random_uuid() é built-in (pgcrypto) e dispensa a extensão uuid-ossp
-- (que não vive no schema public no Supabase). Mais portátil.
create table if not exists public.user_covers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  url text not null,
  variant text not null default 'standard' check (variant in ('standard','elite')),
  created_at timestamptz not null default now()
);

create index if not exists user_covers_user_idx on public.user_covers(user_id, created_at desc);

alter table public.user_covers enable row level security;

drop policy if exists "covers_read_own"  on public.user_covers;
drop policy if exists "covers_write_own" on public.user_covers;

create policy "covers_read_own"
  on public.user_covers for select
  using (auth.uid() = user_id);

create policy "covers_write_own"
  on public.user_covers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- FIFO cap de 10 capas por usuário — ao inserir a 11ª, deleta as mais antigas.
create or replace function public.cap_user_covers()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.user_covers
  where user_id = new.user_id
    and id in (
      select id from public.user_covers
      where user_id = new.user_id
      order by created_at desc
      offset 10
    );
  return new;
end;
$$;

drop trigger if exists trg_cap_user_covers on public.user_covers;
create trigger trg_cap_user_covers
  after insert on public.user_covers
  for each row execute function public.cap_user_covers();

-- Migra cover_url existente como primeira entrada da galeria (back-compat).
insert into public.user_covers (user_id, url, variant, created_at)
select id, cover_url, 'standard', updated_at
from public.profiles
where cover_url is not null and cover_url <> ''
on conflict do nothing;
