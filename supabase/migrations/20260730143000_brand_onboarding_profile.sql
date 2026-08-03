-- Sprint 005: Brand onboarding profile fields.
-- Additive only; does not alter funding, wallet, challenge or settlement tables.

alter table public.accounts
  add column if not exists display_name text,
  add column if not exists brand_name text,
  add column if not exists brand_onboarding_completed_at timestamptz;

create index if not exists accounts_brand_onboarding_idx
  on public.accounts (is_brand, brand_onboarding_completed_at)
  where deleted_at is null;
