
-- SERDAR BÜTÇE PLANI - SUPABASE SCHEMA
-- Supabase > SQL Editor > New query içine yapıştırıp Run'a basın.

create extension if not exists pgcrypto;

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  name text not null,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cutoff_day int,
  due_day int,
  created_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.card_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  month text not null,
  current_spend numeric(14,2) not null default 0,
  carried numeric(14,2) not null default 0,
  interest numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(card_id,month)
);

create table if not exists public.cash_advances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank text not null,
  description text,
  due_date date,
  original_amount numeric(14,2) not null,
  remaining_amount numeric(14,2) not null,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null,
  due_day int,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  category text not null,
  description text,
  amount numeric(14,2) not null,
  payment_method text not null,
  card_name text,
  installments int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_date date not null,
  kind text not null,
  target_id uuid,
  amount numeric(14,2) not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.incomes enable row level security;
alter table public.cards enable row level security;
alter table public.card_months enable row level security;
alter table public.cash_advances enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['incomes','cards','card_months','cash_advances','fixed_expenses','expenses','payments']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
