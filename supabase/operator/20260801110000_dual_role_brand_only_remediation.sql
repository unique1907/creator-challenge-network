-- P0 dual-role account remediation.
-- DO NOT RUN until a separate Creator account has completed the Creator smoke flow.
-- This script intentionally changes only the existing dual-role account to Brand-only.
-- It does not delete, transfer, or rewrite campaigns, submissions, wallets, funding, payout, or settlement records.

set lock_timeout = '10s';
set statement_timeout = '120s';

begin;

-- Operator must replace this with the full account UUID after approval.
-- Expected redacted account in the active project: cb82d778...8278
create temporary table ccn_role_remediation_target(account_id uuid primary key) on commit drop;

-- INSERT INTO ccn_role_remediation_target(account_id)
-- VALUES ('00000000-0000-0000-0000-000000000000');

do $$
begin
  if not exists (select 1 from ccn_role_remediation_target) then
    raise exception 'CCN_ROLE_REMEDIATION_TARGET_REQUIRED';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.accounts a
    join ccn_role_remediation_target t on t.account_id = a.account_id
    where not (a.is_brand = true and a.is_creator = true)
  ) then
    raise exception 'TARGET_ACCOUNT_IS_NOT_DUAL_ROLE';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.accounts a
    join ccn_role_remediation_target t on t.account_id = a.account_id
    where a.brand_onboarding_completed_at is null
  ) then
    raise exception 'TARGET_BRAND_ONBOARDING_NOT_COMPLETE';
  end if;
end $$;

do $$
declare
  changed integer;
begin
  update public.accounts a
  set
    is_brand = true,
    is_creator = false,
    updated_at = now()
  from ccn_role_remediation_target t
  where a.account_id = t.account_id
    and a.is_brand = true
    and a.is_creator = true;

  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'EXPECTED_ONE_ACCOUNT_TO_BE_REMEDIATED_CHANGED_%', changed;
  end if;
end $$;

-- Verification: returns the remediated account role flags without exposing email.
select
  left(a.account_id::text, 8) || '...' || right(a.account_id::text, 4) as redacted_account_id,
  a.is_brand,
  a.is_creator,
  a.account_role,
  a.brand_onboarding_completed_at is not null as brand_onboarding_complete
from public.accounts a
join ccn_role_remediation_target t on t.account_id = a.account_id;

commit;
