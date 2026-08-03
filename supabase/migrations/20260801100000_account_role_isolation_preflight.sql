-- Account role isolation preflight.
-- Additive only: this migration does not choose a primary role for existing dual-role accounts.

alter table public.accounts
  add column if not exists account_role text generated always as (
    case
      when is_brand = true and is_creator = false then 'brand'
      when is_brand = false and is_creator = true then 'creator'
      else null
    end
  ) stored;

create index if not exists accounts_account_role_idx
  on public.accounts (account_role)
  where deleted_at is null;

create or replace view public.ccn_account_role_isolation_audit as
select
  account_id,
  left(account_id::text, 8) || '...' || right(account_id::text, 4) as redacted_account_id,
  is_brand,
  is_creator,
  account_role,
  status,
  case
    when is_brand = true and is_creator = false then 'brand_only'
    when is_brand = false and is_creator = true then 'creator_only'
    when is_brand = true and is_creator = true then 'dual_role'
    else 'no_role'
  end as role_state,
  brand_onboarding_completed_at,
  created_at,
  updated_at,
  deleted_at
from public.accounts;

revoke all on public.ccn_account_role_isolation_audit from anon;
revoke all on public.ccn_account_role_isolation_audit from authenticated;

-- Apply only after dual-role rows are manually remediated:
-- alter table public.accounts
--   add constraint accounts_single_primary_role_check
--   check (not (is_brand = true and is_creator = true));
