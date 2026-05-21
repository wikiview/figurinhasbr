-- Fix bidirectional matching in find_trade_matches.
--
-- Previous version joined on `us_need.qty = 0` to detect stickers the partner
-- needs. Problem: when a user has never marked a sticker, there's no row at all
-- in user_stickers for that pair — the join missed those cases entirely, so
-- `they_need` was always empty for almost every partner. Now we anchor on
-- `my_dupes` and use NOT EXISTS to detect partners who don't own a sticker,
-- regardless of whether they have a zero-qty row.

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
    -- per partner: stickers they have duplicates of AND I'm missing
    select us.user_id as partner_id, us.sticker_id
    from public.user_stickers us
    join candidates c on c.id = us.user_id
    where us.qty >= 2
      and us.sticker_id in (select sticker_id from my_missing)
  ),
  partner_needs as (
    -- per partner: stickers I have duplicates of AND they don't own (no row OR qty = 0)
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
