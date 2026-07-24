# Creator Foundation

Creator Foundation Phase 1 establishes the production persistence and identity shape for CCN Creator accounts. It does not implement submissions, blind review, winner selection, payout execution, file uploads, or Brand flow migration.

## Account Model

Supabase Auth owns user login for the CCN application. The hackathon login surface is Google and Email OTP. After a verified Supabase session exists, the server resolves one `accounts` row by `supabase_user_id`.

One CCN account maps to one Circle user in `circle_users`. That Circle user may have multiple scoped wallets:

- `BRAND_PAYMENT`
- `CREATOR_PAYOUT`

Wallet rows are unique by `(account_id, scope)`. The Creator flow must not use local JSON persistence.

## Recovery Boundaries

Auth recovery and wallet recovery are separate.

Auth recovery restores the same Supabase user and CCN account. Wallet recovery starts from the DB wallet row and only reconciles Circle state through supported Circle user wallet listing or the original deterministic idempotency key. A recovery endpoint must not create a new operation when a pending row can be retried or reconciled.

If Circle returns wallet metadata/refId for a pending initialization, recovery may bind exactly one wallet whose trusted metadata matches the DB row scope. If Circle does not expose a trusted metadata/refId match, CCN must keep the row pending or failed and surface an internal recovery blocker. It must not guess from “the only live wallet” and must not create a replacement wallet during login restore.

## Security Rules

Client code may read only safe account/profile fields. Wallet secrets and backend metadata stay server-side. The public wallet read surface is the `get_my_wallets()` RPC, which returns only:

- `wallet_address`
- `scope`
- `status`
- `blockchain`

The following fields must not be exposed to browser clients:

- Circle user ID
- Circle wallet ID
- wallet idempotency key
- service-role key
- user tokens
- encryption keys
- PIN, OTP, or recovery data

## Hackathon Scope

Phase 1 prepares Supabase schema, RLS, canonical account resolution, Circle user resolution, scoped wallet resolution, creator role enabling, creator profile creation, and append-only audit events.

The wallet resolver can create a Circle initialization challenge when Creator onboarding explicitly begins. The UI flow that executes the challenge is intentionally outside this phase.

## Production Roadmap

- MFA and stronger account recovery.
- KMS-backed operational secrets.
- Multisig or controlled resolver operations.
- Durable payout intent and payout attempt tables.
- Identity-stripped blind review projection tables.
- Object storage with signed uploads and scanning.
- Operational dashboards for pending or failed wallet recovery.

## Phase 2 Discovery Read Model Decisions

Phase 2 discovery will use a Supabase read model, not live Brand JSON pass-through.

- `public_live_challenges` will be an explicit public column allowlist projection.
- Discovery code must not use `SELECT *` or denylist-based field stripping.
- Discovery will not verify blockchain state on every request.
- Discovery will read the canonical status that the Brand flow has already chain-gated and persisted.
- A temporary Brand JSON adapter may exist only as an input to sync; it must not be a live pass-through read path.
- Brand canonical source uses one-way sync into a Supabase read model.
- Creator routes read only the Supabase read model.
- Sync must never write back into Brand JSON.
- Stable cursor sorting is `created_at` plus `challenge_id` as the tiebreaker.
- A cache invalidation seam is required when a challenge leaves `LIVE`.
- Full Brand DB migration is not required for Phase 2.
- Full Brand DB migration is a mandatory decision point before Phase 3 Submission begins.
