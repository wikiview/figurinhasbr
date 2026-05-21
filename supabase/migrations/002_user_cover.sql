-- Adiciona suporte a capa personalizada (selfie + IA)
-- Roda no SQL Editor do Supabase.

alter table public.profiles
  add column if not exists cover_url text,
  add column if not exists favorite_team_code text;

-- Bucket de Storage pra capas geradas (cria policy permissiva)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- RLS no bucket: dono escreve seus arquivos, todos leem (capas são públicas)
drop policy if exists "covers_public_read" on storage.objects;
create policy "covers_public_read"
  on storage.objects for select
  using (bucket_id = 'covers');

drop policy if exists "covers_owner_write" on storage.objects;
create policy "covers_owner_write"
  on storage.objects for all
  using (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );
