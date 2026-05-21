-- Anti-tampering guard on profiles.is_premium
--
-- After the RevenueCat -> Supabase webhook (Edge Function `rc-webhook`)
-- becomes the source of truth for the premium flag, end-user clients
-- must NOT be able to flip `is_premium` themselves. RLS alone can't
-- restrict a single column on an UPDATE/INSERT policy, so we use a
-- BEFORE INSERT OR UPDATE trigger that reverts/forces `is_premium`
-- for any non-service-role caller. INSERT is covered because the
-- existing `profiles_insert_own` RLS policy lets authenticated users
-- create their own row with arbitrary column values.
--
-- The Edge Function uses the SUPABASE_SERVICE_ROLE_KEY, which bypasses
-- this guard (current_setting('role') = 'service_role'); end-user app
-- sessions run as `authenticated` and get their attempted change
-- silently dropped.

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
