# P0 Fresh Challenge Deadline Readiness Fix Report

## Executive Verdict

PASS - CURRENT FUNCTIONAL BASELINE LOCKED

The fresh challenge deadline-readiness fix is included in the Checkpoint functional baseline. The current manual functional checks supplied by the user passed, and the final complete regression will be repeated after dashboard UX consolidation.

## Exact Root Cause

Fresh challenge deadlines were stored as offset-less `datetime-local` strings, for example `2026-08-04T18:40`. Runtime paths parsed those strings independently with `Date.parse` / `new Date`, making interpretation depend on browser/server timezone.

The contract funding intent, challenge lifecycle verifier, workspace display, and payout readiness comparison did not share one deadline model. A present deadline could therefore be treated as mismatched or missing in later readiness checks.

Deneme 2 also had persisted draft deadlines that no longer matched its already-funded escrow deadline seconds. That was repaired by updating only the draft JSON deadline fields to the existing funded escrow values.

## Canonical Deadline Model

Canonical fields remain:

- `reviewRules.submissionDeadline`
- `reviewRules.reviewDeadline`

Canonical stored value is UTC ISO with `Z`. Unix seconds are derived through `src/utils/challenge-deadlines.ts`.

The shared normalizer handles:

- canonical UTC ISO strings
- legacy offset-less `datetime-local` strings
- `submissionDeadlineUtc` / `reviewDeadlineUtc` aliases
- numeric Unix seconds for verifier paths

It distinguishes missing, malformed, invalid order, submission still open, review not reached, and ready states.

## Current Baseline Records

- Deneme 1: Top 1, 1 submission, deadlines normalized, escrow deadline match PASS, current escrow state paid.
- Deneme 2: Top 1, 1 submission, repaired deadlines normalized, escrow deadline match PASS, current escrow state paid.
- Deneme 3: Top 3, 1 submission, deadlines normalized, escrow deadline match PASS, current escrow state funded/unpaid.
- Coffee-shop challenge: Top 1, 1 submission, Completed, payout-confirmed, paid escrow state preserved.

The current Deneme 1/2 payout-confirmed state reflects live state that advanced outside this closure task. No payout was executed by this closure task.

## Manual Evidence Supplied By User

- Fresh challenges can be created.
- Creator submissions are persisted.
- Deneme 1/2/3 show 1 solution.
- Top 3 validation correctly blocks finalization when only one winner is selected.
- The displayed error is `Exactly 3 winners must be selected.`
- No false missing-deadline error appeared in the tested flow.
- Completed coffee-shop challenge remains settled.
- Previous payout flow already succeeded.

## Automated Results

- `npm.cmd run test:p0-fresh-challenge-deadline-readiness` - PASS
- `npm.cmd run test:p0-brand-challenge-list-data-integrity` - PASS
- `npm.cmd run test:p0-winner-finalization-transition` - PASS
- `npm.cmd run test:p0-campaign-workspace-hydration` - PASS
- `npm.cmd run test:create-challenge-store-safety` - PASS
- `npm.cmd run test:role-isolation` - PASS
- `npm.cmd run lint` - PASS
- `npm.cmd run typecheck` - PASS
- `npm.cmd run build` - PASS
- `git diff --check` - PASS with CRLF warnings only

## Stale Verifier Findings

- `npm.cmd run test:p0-brand-dashboard-ux-completion` fails because its dashboard-only scope guard rejects intended P0 changes in finalize-review and funding/deadline files.
- `npm.cmd run test:ux-02a-brand-dashboard` fails because it asserts older dashboard copy such as `Create your first challenge`.
- These are stale static-verifier expectations and do not block this functional baseline commit.

## Scope Safety

- Deneme 2 deadline repair changed only Supabase draft JSON deadline fields to match the already-funded escrow snapshot.
- No payout was executed during this closure task.
- No Circle API was called during this closure task.
- Arc usage during this closure was limited to read-only `eth_call` verification.
- No Arc state-changing transaction was performed during this closure task.
- Final complete end-to-end regression is planned after dashboard UX consolidation.
