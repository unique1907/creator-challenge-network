-- Checkpoint 3 P0 lifecycle persistence.
-- Canonical challenge, funding, submission, blind review, winner and payout state.

create table if not exists public.ccn_challenge_drafts (
  draft_id text primary key,
  challenge_id text not null unique check (challenge_id ~ '^0x[0-9a-fA-F]{64}$'),
  funding_intent_id text not null unique,
  slug text not null,
  title text not null,
  brand_name text not null,
  publication_status text not null check (publication_status in ('draft', 'ready-to-publish', 'live')),
  funding_status text not null,
  escrow_status text not null,
  event_verified boolean not null default false,
  draft_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ccn_challenge_drafts_live_slug_key
  on public.ccn_challenge_drafts (slug)
  where publication_status = 'live';

create index if not exists ccn_challenge_drafts_publication_idx
  on public.ccn_challenge_drafts (publication_status, updated_at desc);

create table if not exists public.ccn_challenge_funding_records (
  record_key text primary key,
  ccn_account_id text not null,
  wallet_id text not null,
  draft_id text not null references public.ccn_challenge_drafts(draft_id) on delete cascade,
  challenge_id text not null references public.ccn_challenge_drafts(challenge_id) on delete cascade,
  funding_intent_id text not null references public.ccn_challenge_drafts(funding_intent_id) on delete cascade,
  funding_verified boolean not null default false,
  event_verified boolean not null default false,
  published boolean not null default false,
  record_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ccn_account_id, wallet_id, draft_id, challenge_id, funding_intent_id)
);

create index if not exists ccn_challenge_funding_records_scope_idx
  on public.ccn_challenge_funding_records (ccn_account_id, wallet_id, draft_id, funding_intent_id);

create table if not exists public.ccn_wallet_approval_attempts (
  scope_key text not null,
  circle_challenge_id text not null,
  sequence integer not null check (sequence > 0),
  ccn_account_id text not null,
  wallet_id text not null,
  draft_id text not null references public.ccn_challenge_drafts(draft_id) on delete cascade,
  challenge_id text not null references public.ccn_challenge_drafts(challenge_id) on delete cascade,
  funding_intent_id text not null references public.ccn_challenge_drafts(funding_intent_id) on delete cascade,
  circle_status text not null,
  circle_transaction_id text,
  transaction_hash text check (transaction_hash is null or transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  idempotency_key text not null,
  attempt_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope_key, circle_challenge_id),
  unique (idempotency_key)
);

create index if not exists ccn_wallet_approval_attempts_scope_idx
  on public.ccn_wallet_approval_attempts (ccn_account_id, wallet_id, draft_id, funding_intent_id, sequence);

create table if not exists public.ccn_funding_attempts (
  scope_key text not null,
  circle_challenge_id text not null,
  sequence integer not null check (sequence > 0),
  ccn_account_id text not null,
  wallet_id text not null,
  draft_id text not null references public.ccn_challenge_drafts(draft_id) on delete cascade,
  challenge_id text not null references public.ccn_challenge_drafts(challenge_id) on delete cascade,
  funding_intent_id text not null references public.ccn_challenge_drafts(funding_intent_id) on delete cascade,
  circle_status text not null,
  circle_transaction_id text,
  transaction_hash text check (transaction_hash is null or transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  idempotency_key text not null,
  attempt_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope_key, circle_challenge_id),
  unique (idempotency_key)
);

create index if not exists ccn_funding_attempts_scope_idx
  on public.ccn_funding_attempts (ccn_account_id, wallet_id, draft_id, funding_intent_id, sequence);

create table if not exists public.ccn_creator_submissions (
  submission_id text primary key,
  challenge_id text not null references public.ccn_challenge_drafts(challenge_id) on delete cascade,
  creator_account_id text not null,
  creator_wallet_address text not null check (creator_wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  anonymous_entry_code text not null unique,
  title text not null,
  status text not null check (status in ('DRAFT', 'SUBMITTED', 'WITHDRAWN', 'SHORTLISTED', 'WINNER', 'REJECTED')),
  version integer not null default 1 check (version > 0 and version <= 3),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  submission_state jsonb not null,
  unique (challenge_id, creator_account_id)
);

create index if not exists ccn_creator_submissions_blind_review_idx
  on public.ccn_creator_submissions (challenge_id, status, submitted_at);

create table if not exists public.ccn_submission_finalize_keys (
  finalize_key text primary key,
  submission_id text not null references public.ccn_creator_submissions(submission_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ccn_review_scores (
  score_id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.ccn_challenge_drafts(challenge_id) on delete cascade,
  submission_id text not null references public.ccn_creator_submissions(submission_id) on delete cascade,
  reviewer_account_id text,
  score numeric(6,2) check (score is null or (score >= 0 and score <= 100)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, submission_id, reviewer_account_id)
);

create table if not exists public.ccn_winner_finalization_attempts (
  scope_key text primary key,
  ccn_account_id text not null,
  draft_id text not null references public.ccn_challenge_drafts(draft_id) on delete cascade,
  challenge_id text not null references public.ccn_challenge_drafts(challenge_id) on delete cascade,
  funding_intent_id text not null references public.ccn_challenge_drafts(funding_intent_id) on delete cascade,
  state text not null,
  circle_challenge_id text,
  circle_transaction_id text,
  transaction_hash text check (transaction_hash is null or transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  idempotency_key text not null unique,
  attempt_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ccn_payout_intent_once_per_challenge_idx
  on public.ccn_winner_finalization_attempts (challenge_id)
  where state in ('READY_FOR_FINAL_SELECTION', 'ACTION_REQUIRED', 'TRANSACTION_SUBMITTED', 'PAYOUT_CONFIRMED', 'ALREADY_FINALIZED');

create table if not exists public.ccn_onchain_verifications (
  tx_hash text primary key check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  circle_transaction_id text not null,
  circle_challenge_id text not null,
  draft_id text not null references public.ccn_challenge_drafts(draft_id) on delete cascade,
  challenge_id text not null references public.ccn_challenge_drafts(challenge_id) on delete cascade,
  funding_intent_id text not null references public.ccn_challenge_drafts(funding_intent_id) on delete cascade,
  event_type text not null check (event_type in ('ChallengeFunded', 'ChallengePayout', 'ChallengeRefund')),
  receipt_verified boolean not null default false,
  event_verified boolean not null default false,
  challenge_verified boolean not null default false,
  verification_state jsonb not null,
  verified_at timestamptz not null default now()
);

create unique index if not exists ccn_onchain_verifications_dedup_idx
  on public.ccn_onchain_verifications (challenge_id, event_type, tx_hash);

create table if not exists public.ccn_lifecycle_events (
  event_id uuid primary key default gen_random_uuid(),
  draft_id text references public.ccn_challenge_drafts(draft_id) on delete set null,
  challenge_id text,
  event_type text not null,
  actor text not null default 'SYSTEM',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ccn_lifecycle_events_challenge_idx
  on public.ccn_lifecycle_events (challenge_id, created_at desc);

create table if not exists public.ccn_wallet_mappings (
  mapping_key text primary key,
  ccn_account_id text not null,
  role text not null check (role in ('BRAND', 'CREATOR')),
  purpose text not null check (purpose in ('PAYMENT', 'PAYOUT', 'LEGACY')),
  circle_user_id text not null,
  wallet_id text not null,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  blockchain text not null check (blockchain = 'ARC-TESTNET'),
  account_type text not null check (account_type in ('SCA', 'EOA', 'MSCA')),
  wallet_state text not null,
  mapping_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ccn_account_id, role, purpose),
  unique (wallet_id)
);

create index if not exists ccn_wallet_mappings_address_idx
  on public.ccn_wallet_mappings (lower(wallet_address));

create table if not exists public.ccn_legacy_wallet_records (
  internal_user_id text primary key,
  wallet_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
