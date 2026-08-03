-- Checkpoint 3 hardening: ensure public.accounts.supabase_user_id is bound
-- to Supabase Auth users even when an earlier live project created accounts
-- before the Sprint 8C remediation migration added the inline FK.

do $$
declare
  orphan_count integer;
begin
  if to_regclass('public.accounts') is null then
    raise exception 'public.accounts does not exist; apply the accounts foundation migration first';
  end if;

  select count(*)
  into orphan_count
  from public.accounts accounts
  left join auth.users users
    on users.id = accounts.supabase_user_id
  where accounts.supabase_user_id is not null
    and users.id is null;

  if orphan_count > 0 then
    raise exception 'Cannot add accounts_supabase_user_id_auth_users_fkey: % orphan account row(s) reference missing auth.users records', orphan_count;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'public'
      and table_row.relname = 'accounts'
      and constraint_row.conname = 'accounts_supabase_user_id_auth_users_fkey'
  ) then
    alter table public.accounts
      add constraint accounts_supabase_user_id_auth_users_fkey
      foreign key (supabase_user_id)
      references auth.users(id)
      on delete restrict
      not valid;
  end if;
end $$;

alter table public.accounts
  validate constraint accounts_supabase_user_id_auth_users_fkey;

create unique index if not exists accounts_supabase_user_id_unique
  on public.accounts (supabase_user_id);

alter table public.accounts enable row level security;

revoke all on public.accounts from anon, authenticated;
grant select on public.accounts to authenticated;

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own
on public.accounts
for select
to authenticated
using (supabase_user_id = auth.uid() and deleted_at is null);
