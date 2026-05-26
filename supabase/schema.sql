-- Figurinha — Copa do Mundo 2026
-- Supabase schema. Rode tudo isso na aba SQL Editor do Supabase (uma vez).

create extension if not exists "uuid-ossp";

-- ======================================================
-- PROFILES (estende auth.users)
-- ======================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null,
  city text not null,
  state text not null,
  whatsapp text,
  avatar_url text,
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ======================================================
-- STICKERS (catálogo mestre — 1 linha por figurinha do álbum)
-- ======================================================
create table if not exists public.stickers (
  id text primary key,                        -- ex: "BRA-04", "FWC-LOGO"
  number text not null,                       -- "04", "LOGO"
  team text not null,                         -- "Brasil", "Argentina", "Especiais"
  team_code text,                             -- "BRA"
  player_name text,                           -- nome do jogador (null pra escudo/logo)
  type text not null default 'player',        -- 'player' | 'team' | 'logo' | 'legend' | 'special'
  is_shiny boolean not null default false,    -- brilhante / rara
  image_url text,
  display_order int
);

create index if not exists stickers_team_idx on public.stickers(team);
create index if not exists stickers_order_idx on public.stickers(display_order);

-- ======================================================
-- USER_STICKERS (coleção de cada usuário)
-- qty = 0 → não tem | 1 → tem | 2+ → tem repetidas
-- ======================================================
create table if not exists public.user_stickers (
  user_id uuid references public.profiles(id) on delete cascade,
  sticker_id text references public.stickers(id) on delete cascade,
  qty int not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, sticker_id)
);

create index if not exists us_sticker_qty_idx on public.user_stickers(sticker_id, qty);
create index if not exists us_user_idx on public.user_stickers(user_id);

-- ======================================================
-- TRADE_REQUESTS (proposta de troca)
-- ======================================================
create table if not exists public.trade_requests (
  id uuid primary key default uuid_generate_v4(),
  from_user uuid references public.profiles(id) on delete cascade not null,
  to_user uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','completed','cancelled')),
  offer_sticker_ids text[] not null default '{}',
  ask_sticker_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trade_from_idx on public.trade_requests(from_user, status);
create index if not exists trade_to_idx on public.trade_requests(to_user, status);

-- ======================================================
-- TRADE_MESSAGES (chat dentro da troca — opcional v1)
-- ======================================================
create table if not exists public.trade_messages (
  id uuid primary key default uuid_generate_v4(),
  trade_id uuid references public.trade_requests(id) on delete cascade not null,
  from_user uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists msg_trade_idx on public.trade_messages(trade_id, created_at);

-- ======================================================
-- USER_RATINGS (avaliação pós-troca)
-- ======================================================
create table if not exists public.user_ratings (
  rater_id uuid references public.profiles(id) on delete cascade,
  rated_id uuid references public.profiles(id) on delete cascade,
  trade_id uuid references public.trade_requests(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  primary key (rater_id, trade_id)
);

-- ======================================================
-- ROW LEVEL SECURITY
-- ======================================================
alter table public.profiles        enable row level security;
alter table public.stickers        enable row level security;
alter table public.user_stickers   enable row level security;
alter table public.trade_requests  enable row level security;
alter table public.trade_messages  enable row level security;
alter table public.user_ratings    enable row level security;

-- Profiles: todos autenticados podem ler, só dono escreve
drop policy if exists "profiles_read"        on public.profiles;
drop policy if exists "profiles_insert_own"  on public.profiles;
drop policy if exists "profiles_update_own"  on public.profiles;
create policy "profiles_read"        on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles_insert_own"  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"  on public.profiles for update using (auth.uid() = id);

-- ======================================================
-- ANTI-TAMPERING: guard profiles.is_premium
-- ======================================================
-- The `is_premium` flag is the gate for paid features. We cannot allow
-- end-users to flip it from the client even though they own the row.
--
-- Postgres RLS doesn't natively express "owner may write everything
-- except column X". The canonical workaround is a BEFORE INSERT OR
-- UPDATE trigger that forces `is_premium` for non-service-role callers:
--   - on INSERT: force false (the `profiles_insert_own` policy lets
--     authenticated users create their row with arbitrary column values).
--   - on UPDATE: revert any change to OLD.is_premium.
-- The Edge Function `rc-webhook` uses the service role key, so the
-- RevenueCat webhook can still write; clients (running as the
-- `authenticated` role) get their attempted change silently dropped.
create or replace function public.guard_profile_is_premium()
returns trigger language plpgsql
security definer set search_path = public, auth
as $$
begin
  if current_setting('role', true) is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      new.is_premium := false;
    elsif tg_op = 'UPDATE' and new.is_premium is distinct from old.is_premium then
      new.is_premium := old.is_premium;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_is_premium on public.profiles;
create trigger trg_guard_profile_is_premium
  before insert or update on public.profiles
  for each row execute function public.guard_profile_is_premium();

-- Stickers: todos podem ler (mesmo deslogado, pra preview)
drop policy if exists "stickers_read" on public.stickers;
create policy "stickers_read" on public.stickers for select using (true);

-- User_stickers: todos autenticados leem (pra matching), só dono escreve
drop policy if exists "us_read"      on public.user_stickers;
drop policy if exists "us_write_own" on public.user_stickers;
create policy "us_read"      on public.user_stickers for select using (auth.role() = 'authenticated');
create policy "us_write_own" on public.user_stickers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trade requests: ler se envolvido, criar como remetente, atualizar se envolvido
drop policy if exists "trade_read"           on public.trade_requests;
drop policy if exists "trade_create_own"     on public.trade_requests;
drop policy if exists "trade_update_involved" on public.trade_requests;
create policy "trade_read"           on public.trade_requests for select
  using (auth.uid() = from_user or auth.uid() = to_user);
create policy "trade_create_own"     on public.trade_requests for insert
  with check (auth.uid() = from_user);
create policy "trade_update_involved" on public.trade_requests for update
  using (auth.uid() = from_user or auth.uid() = to_user);

-- Mensagens: ler/escrever se for parte da troca
drop policy if exists "msg_read"   on public.trade_messages;
drop policy if exists "msg_create" on public.trade_messages;
create policy "msg_read" on public.trade_messages for select using (
  exists(select 1 from public.trade_requests t
         where t.id = trade_id and (auth.uid() = t.from_user or auth.uid() = t.to_user))
);
create policy "msg_create" on public.trade_messages for insert with check (
  auth.uid() = from_user
  and exists(select 1 from public.trade_requests t
             where t.id = trade_id and (auth.uid() = t.from_user or auth.uid() = t.to_user))
);

-- Ratings
drop policy if exists "ratings_read"   on public.user_ratings;
drop policy if exists "ratings_create" on public.user_ratings;
create policy "ratings_read"   on public.user_ratings for select using (true);
create policy "ratings_create" on public.user_ratings for insert with check (auth.uid() = rater_id);

-- ======================================================
-- TRIGGER: criar profile automaticamente após signup
-- ======================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, city, state)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'city', ''),
    coalesce(new.raw_user_meta_data->>'state', '')
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ======================================================
-- RPC: matching de trocas
-- scope: 'city' (mesma cidade+UF), 'state' (mesma UF), 'all' (qualquer lugar)
-- ======================================================
create or replace function public.find_trade_matches(
  my_id uuid,
  scope text default 'city'
)
returns table (
  partner_id uuid,
  display_name text,
  city text,
  state text,
  whatsapp text,
  avatar_url text,
  they_offer text[],
  they_need text[],
  match_score int
) language sql stable security definer set search_path = public as $$
  with me as (
    select id, city, state from public.profiles where id = my_id
  ),
  my_owned as (
    select sticker_id from public.user_stickers
    where user_id = my_id and qty >= 1
  ),
  my_missing as (
    select s.id as sticker_id from public.stickers s
    where s.id not in (select sticker_id from my_owned)
  ),
  my_dupes as (
    select sticker_id from public.user_stickers
    where user_id = my_id and qty >= 2
  ),
  candidates as (
    select p.*
    from public.profiles p
    cross join me
    where p.id <> my_id
      and (
        scope = 'all'
        or (scope = 'state' and p.state = me.state)
        or (scope = 'city' and p.city = me.city and p.state = me.state)
      )
  ),
  partner_offers as (
    select us.user_id as partner_id, us.sticker_id
    from public.user_stickers us
    join candidates c on c.id = us.user_id
    where us.qty >= 2
      and us.sticker_id in (select sticker_id from my_missing)
  ),
  partner_needs as (
    -- partner doesn't own this sticker: no row at all OR qty = 0
    select c.id as partner_id, d.sticker_id
    from candidates c
    cross join my_dupes d
    where not exists (
      select 1 from public.user_stickers us
      where us.user_id = c.id
        and us.sticker_id = d.sticker_id
        and us.qty >= 1
    )
  )
  select
    c.id as partner_id,
    c.display_name,
    c.city,
    c.state,
    c.whatsapp,
    c.avatar_url,
    coalesce(array_agg(distinct po.sticker_id) filter (where po.sticker_id is not null), '{}') as they_offer,
    coalesce(array_agg(distinct pn.sticker_id) filter (where pn.sticker_id is not null), '{}') as they_need,
    (count(distinct po.sticker_id) + count(distinct pn.sticker_id))::int as match_score
  from candidates c
  left join partner_offers po on po.partner_id = c.id
  left join partner_needs   pn on pn.partner_id = c.id
  group by c.id, c.display_name, c.city, c.state, c.whatsapp, c.avatar_url
  having count(distinct po.sticker_id) > 0
  order by match_score desc
  limit 50;
$$;

-- ======================================================
-- RPC: ranking de raridade
-- Para cada figurinha, calcula quantos colecionadores ativos têm.
-- rarity_pct baixo = mais rara; alto = mais comum.
-- ======================================================
create or replace function public.get_sticker_rarities()
returns table (
  id text,
  number text,
  team text,
  team_code text,
  player_name text,
  is_shiny boolean,
  owners int,
  total_active int,
  rarity_pct numeric
) language sql stable security definer set search_path = public as $$
  with active as (
    select count(distinct user_id)::int as total
    from public.user_stickers
    where qty >= 1
  )
  select
    s.id,
    s.number,
    s.team,
    s.team_code,
    s.player_name,
    s.is_shiny,
    count(distinct us.user_id)::int as owners,
    a.total as total_active,
    case when a.total > 0
      then round((count(distinct us.user_id)::numeric / a.total) * 100, 1)
      else 0
    end as rarity_pct
  from public.stickers s
  cross join active a
  left join public.user_stickers us
    on us.sticker_id = s.id and us.qty >= 1
  group by s.id, s.number, s.team, s.team_code, s.player_name, s.is_shiny, a.total
  order by rarity_pct asc, s.display_order;
$$;
