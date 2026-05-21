-- Contador de Capas Elite geradas por usuário.
-- Free user com o achievement `elite_collector` tem direito a UMA geração grátis
-- (gated por rewarded ad no client). Premium não é capado.
-- O incremento acontece no Edge Function `generate-cover` com SERVICE_ROLE,
-- então não precisa de RLS extra — o guard de `is_premium` (migration 004)
-- já protege o que usuário pode mexer no próprio profile.

alter table public.profiles
  add column if not exists elite_covers_generated integer not null default 0;

-- Back-fill: usuários que já geraram capas Elite antes deste cap entram
-- considerados como tendo "consumido" a cota. Garante que ninguém que já
-- usou volte a ter capa grátis depois do deploy.
update public.profiles p
   set elite_covers_generated = sub.cnt
  from (
    select user_id, count(*)::int as cnt
      from public.user_covers
     where variant = 'elite'
     group by user_id
  ) sub
 where sub.user_id = p.id
   and p.elite_covers_generated = 0;
