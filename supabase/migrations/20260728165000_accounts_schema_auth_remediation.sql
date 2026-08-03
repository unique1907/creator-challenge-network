create extension if not exists pgcrypto;

-- Sprint 8C remediation: create the canonical account table expected by
-- Supabase Auth backed workspace authorization when earlier foundation
-- migrations were not applied to a live project.
do $$
begin
  create type public.account_status as enum ('ACTIVE', 'DEACTIVATED');
exception
  when duplicate_object then null;
end $$;

do $$
declare
  missing_columns text[];
begin
  if to_regclass('public.accounts') is not null then
    select array_agg(required.column_name)
    into missing_columns
    from (
      values
        ('account_id'),
        ('supabase_user_id'),
        ('is_brand'),
        ('is_creator'),
        ('primary_email'),
        ('status'),
        ('created_at'),
        ('updated_at'),
        ('deleted_at')
    ) as required(column_name)
    where not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'accounts'
        and column_name = required.column_name
    );

    if missing_columns is not null then
      raise exception 'public.accounts exists but is missing required canonical columns: %', missing_columns;
    end if;
  end if;
end $$;

create table if not exists public.accounts (
  account_id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid not null unique references auth.users(id) on delete restrict,
  is_brand boolean not null default false,
  is_creator boolean not null default false,
  primary_email text not null,
  status public.account_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists accounts_supabase_user_id_unique
  on public.accounts (supabase_user_id);

create index if not exists accounts_active_lookup_idx
  on public.accounts (supabase_user_id, status)
  where deleted_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;

revoke all on public.accounts from anon, authenticated;
grant select on public.accounts to authenticated;

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own
on public.accounts
for select
to authenticated
using (supabase_user_id = auth.uid() and deleted_at is null);