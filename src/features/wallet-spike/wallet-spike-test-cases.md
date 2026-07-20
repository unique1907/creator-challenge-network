# Internal Wallet Spike Test Cases

These tests are documented for Sprint 3A and must be run only in development
with testnet Circle credentials.

1. Google-authenticated CCN account: choose Google, create app wallet session, and confirm Circle user token is issued server-side.
2. Apple-authenticated CCN account: choose Apple, create app wallet session, and confirm Circle user token is issued server-side.
3. Email-authenticated CCN account: choose Email as a CCN provider and confirm Circle Email OTP is not invoked.
4. Invalid CCN account ID: enter malformed account ID and confirm the safe error panel.
5. Browser refresh after app session: refresh and confirm no frontend token persistence.
6. Duplicate wallet initialization click: click initialize repeatedly and confirm stable idempotency/mapping.
7. API timeout during wallet initialization: simulate unavailable Circle API and confirm redacted timeout.
8. Retry same logical operation: retry initialize and confirm the same idempotency operation is reused.
9. Wallet already exists: repeat with the same CCN account ID and confirm stored mapping is reused.
10. Wrong blockchain response: confirm non-ARC-TESTNET wallet responses are rejected.
11. Wallet created but local mapping fails: confirm status can be refreshed for reconciliation.
12. Safe recovery after mapping failure: refresh wallet status after restoring local store.
13. Sensitive values absent from browser console: inspect console for tokens/API keys/secrets.
14. Sensitive values absent from server logs: inspect logs for tokens/API keys/secrets.
15. Circle Email OTP absent: confirm no `/circle/otp/*` API routes are exposed.
16. Public navigation remains unchanged: confirm `/internal/wallet-spike` is not linked publicly.
17. Public routes remain unchanged: verify `/`, `/challenges`, and one challenge detail page.
