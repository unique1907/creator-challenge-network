-- CCN P0 Creator profile/avatar persistence runtime fix
-- Additive only. No financial, lifecycle, Circle, Arc, wallet or Brand state changes.

alter table if exists public.creator_profiles
  add column if not exists auth_user_id uuid,
  add column if not exists username_normalized text,
  add column if not exists avatar_image_key text,
  add column if not exists avatar_image_updated_at timestamptz;

update public.creator_profiles cp
set auth_user_id = a.supabase_user_id
from public.accounts a
where cp.account_id = a.account_id
  and cp.auth_user_id is null;

update public.creator_profiles
set username_normalized = lower(trim(username))
where username is not null
  and (username_normalized is null or username_normalized <> lower(trim(username)));

update public.creator_profiles cp
set avatar_image_key = a.avatar_image_key,
    avatar_image_updated_at = coalesce(a.avatar_image_updated_at, cp.avatar_image_updated_at)
from public.accounts a
where cp.account_id = a.account_id
  and cp.avatar_image_key is null
  and a.avatar_image_key is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creator_profiles_auth_user_id_fkey'
      and conrelid = 'public.creator_profiles'::regclass
  ) then
    alter table public.creator_profiles
      add constraint creator_profiles_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creator_profiles_username_normalized_format'
      and conrelid = 'public.creator_profiles'::regclass
  ) then
    alter table public.creator_profiles
      add constraint creator_profiles_username_normalized_format
      check (username_normalized is null or username_normalized ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$');
  end if;
end $$;

create unique index if not exists creator_profiles_auth_user_id_unique
  on public.creator_profiles (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists creator_profiles_username_normalized_unique
  on public.creator_profiles (username_normalized)
  where username_normalized is not null;

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
  if old.auth_user_id is not null and new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'creator_profiles.auth_user_id is immutable once set';
  end if;
  return new;
end;
$$;

grant update (display_name, username, username_normalized, country, avatar_image_key, avatar_image_updated_at) on public.creator_profiles to authenticated;
