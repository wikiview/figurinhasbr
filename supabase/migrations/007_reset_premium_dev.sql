-- Reset ad-hoc: limpa is_premium de todos os usuários atuais.
-- Roda via `supabase db push` (que usa service_role), então o trigger
-- `guard_profile_is_premium` não bloqueia o UPDATE.
--
-- Justificativa: durante testes do TestFlight, vários perfis ficaram com
-- is_premium=true por compras de sandbox. Como a Apple/TestFlight não
-- gera webhook real pra essas compras, o estado fica "sujo". Esta migration
-- zera tudo pra recomeçar limpo agora que o build #3 (com IAP nativo) vai
-- entrar em circulação.

update public.profiles
set is_premium = false,
    updated_at = now()
where is_premium = true;
