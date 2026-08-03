-- Enforce one primary role per canonical account.
-- Apply only after all dual-role accounts have been manually remediated.

set lock_timeout = '10s';
set statement_timeout = '120s';

do $$
begin
  if exists (
    select 1
    from public.accounts
    where is_brand = true
      and is_creator = true
      and deleted_at is null
  ) then
    raise exception 'DUAL_ROLE_ACCOUNTS_REMAIN';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_single_primary_role_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_single_primary_role_check
      check (not (is_brand = true and is_creator = true));
  end if;
end $$;
