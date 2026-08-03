# Creator Submission Spike Test Cases

Sprint 5A is an internal development spike. These checks are validated with
the protected internal routes, ignored local stores, and the Circle hosted UI.

## Creator Wallet

- Creator user is created or fetched for `ccn-test-creator-001`.
- Creator wallet initialization uses ARC-TESTNET and SCA only.
- Existing wallet mapping is restored after refresh.
- Duplicate wallet creation is blocked by the local mapping guard.
- Brand wallet mapping is not reused.
- No faucet funds are requested for the Creator.

## Challenge Read

- Existing Sprint 4D challenge ID is loaded from ignored local state.
- CCNEscrow bytecode exists on Arc Testnet.
- `isFunded(challengeId)` is true.
- Sponsor, prize pool, platform fee, winner count, and distribution match the
  verified Sprint 4D funding.
- Submission deadline is still open.
- Paused contract or mismatched challenge state blocks submission writes.

## Submission

- Draft creation validates required title, description, and URL fields.
- Draft can be edited before finalization.
- Finalized submission becomes immutable in Sprint 5A.
- Anonymous entry code is generated server-side and remains stable.
- Repeated finalize requests return the existing submission.
- One active submission per Creator and challenge is enforced.
- Browser refresh restores draft or submitted state from ignored local storage.

## Blind Review

- Brand review receives `anonymousEntryCode`.
- Brand review does not receive Creator account ID.
- Brand review does not receive Creator wallet address.
- Brand review does not receive email, name, Circle user ID, or wallet ID.
- API response is projected server-side as `BlindReviewEntry`; fields are not
  hidden with CSS.
- Identity-leak assertion must pass before entries are returned.

## Security

- Circle API keys, user tokens, encryption keys, PINs, recovery answers, and
  local auth secrets are never persisted.
- Local stores remain under ignored `.local/`.
- Internal routes are disabled outside development.
- No payout, refund, faucet request, or escrow state-changing call is made in
  Sprint 5A.
