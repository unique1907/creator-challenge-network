create extension if not exists pgcrypto;

do $$
begin
  create type public.account_status as enum ('ACTIVE', 'DEACTIVATED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.wallet_scope as enum ('BRAND_PAYMENT', 'CREATOR_PAYOUT');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.wallet_status as enum ('PENDING', 'ACTIVE', 'FAILED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.audit_actor as enum ('USER', 'SERVICE', 'SYSTEM');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.accounts (
  account_id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid not null unique,
  is_brand boolean not null default false,
  is_creator boolean not null default false,
  primary_email text not null,
  status public.account_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.circle_users (
  circle_user_row_id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(account_id) on delete restrict,
  circle_user_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  wallet_row_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(account_id) on delete restrict,
  circle_user_row_id uuid not null references public.circle_users(circle_user_row_id) on delete restrict,
  scope public.wallet_scope not null,
  circle_wallet_id text unique,
  wallet_address text,
  blockchain text not null,
  status public.wallet_status not null default 'PENDING',
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_account_scope_unique unique (account_id, scope),
  constraint wallets_address_format check (wallet_address is null or wallet_address ~* '^0x[0-9a-f]{40}$')
);

create unique index if not exists wallets_blockchain_wallet_address_unique
  on public.wallets (blockchain, lower(wallet_address))
  where wallet_address is not null;

create table if not exists public.creator_profiles (
  account_id uuid primary key references public.accounts(account_id) on delete restrict,
  display_name text,
  username text unique,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(account_id) on delete set null,
  event_type text not null,
  actor public.audit_actor not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at
before update on public.wallets
for each row execute function public.set_updated_at();

drop trigger if exists creator_profiles_set_updated_at on public.creator_profiles;
create trigger creator_profiles_set_updated_at
before update on public.creator_profiles
for each row execute function public.set_updated_at();

create or replace function public.prevent_creator_profile_protected_field_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.account_id is distinct from old.account_id then
    raise exception 'creator_profiles.account_id is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'creator_profiles.created_at is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists creator_profiles_protected_fields on public.creator_profiles;
create trigger creator_profiles_protected_fields
before update on public.creator_profiles
for each row execute function public.prevent_creator_profile_protected_field_update();

create or replace function public.prevent_auth_audit_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'auth_audit_events is append-only';
end;
$$;

drop trigger if exists auth_audit_events_no_update on public.auth_audit_events;
create trigger auth_audit_events_no_update
before update on public.auth_audit_events
for each row execute function public.prevent_auth_audit_event_mutation();

drop trigger if exists auth_audit_events_no_delete on public.auth_audit_events;
create trigger auth_audit_events_no_delete
before delete on public.auth_audit_events
for each row execute function public.prevent_auth_audit_event_mutation();

alter table public.accounts enable row level security;
alter table public.circle_users enable row level security;
alter table public.wallets enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.auth_audit_events enable row level security;

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own
on public.accounts
for select
to authenticated
using (supabase_user_id = auth.uid() and deleted_at is null);

drop policy if exists creator_profiles_select_own on public.creator_profiles;
create policy creator_profiles_select_own
on public.creator_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.accounts
    where accounts.account_id = creator_profiles.account_id
      and accounts.supabase_user_id = auth.uid()
      and accounts.deleted_at is null
  )
);

drop policy if exists creator_profiles_update_own on public.creator_profiles;
create policy creator_profiles_update_own
on public.creator_profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.accounts
    where accounts.account_id = creator_profiles.account_id
      and accounts.supabase_user_id = auth.uid()
      and accounts.deleted_at is null
  )
)
with check (
  exists (
    select 1
    from public.accounts
    where accounts.account_id = creator_profiles.account_id
      and accounts.supabase_user_id = auth.uid()
      and accounts.deleted_at is null
  )
);

create or replace function public.get_my_wallets()
returns table (
  wallet_address text,
  scope public.wallet_scope,
  status public.wallet_status,
  blockchain text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.wallets.wallet_address, public.wallets.scope, public.wallets.status, public.wallets.blockchain
  from public.wallets
  join public.accounts on public.accounts.account_id = public.wallets.account_id
  where public.accounts.supabase_user_id = auth.uid()
    and public.accounts.deleted_at is null;
$$;

revoke all on public.accounts from anon, authenticated;
revoke all on public.circle_users from anon, authenticated;
revoke all on public.wallets from anon, authenticated;
revoke all on public.creator_profiles from anon, authenticated;
revoke all on public.auth_audit_events from anon, authenticated;

grant select on public.accounts to authenticated;
grant select on public.creator_profiles to authenticated;
grant update (display_name, username, country) on public.creator_profiles to authenticated;
grant execute on function public.get_my_wallets() to authenticated;
