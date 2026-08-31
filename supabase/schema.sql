-- Serdar'ın Bütçe Planı - Supabase veritabanı
-- Supabase > SQL Editor bölümünde bu dosyanın tamamını bir kez çalıştırın.

create table if not exists public.budget_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.budget_profiles enable row level security;

drop policy if exists "Kullanici kendi butcesini okuyabilir" on public.budget_profiles;
create policy "Kullanici kendi butcesini okuyabilir"
on public.budget_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Kullanici kendi butcesini olusturabilir" on public.budget_profiles;
create policy "Kullanici kendi butcesini olusturabilir"
on public.budget_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Kullanici kendi butcesini guncelleyebilir" on public.budget_profiles;
create policy "Kullanici kendi butcesini guncelleyebilir"
on public.budget_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Kullanici kendi butcesini silebilir" on public.budget_profiles;
create policy "Kullanici kendi butcesini silebilir"
on public.budget_profiles for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists budget_profiles_set_updated_at on public.budget_profiles;
create trigger budget_profiles_set_updated_at
before update on public.budget_profiles
for each row execute function public.set_updated_at();

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.budget_profiles to authenticated;
