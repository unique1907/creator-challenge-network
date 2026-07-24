# Sprint 6A Create Challenge Test Cases

## Basics
- Required fields reject empty title, brand, category, summary, brief, and primary deliverable.
- Title must be 5-100 characters.
- Summary must be 240 characters or less.
- Reference links must be valid HTTP or HTTPS URLs.
- Draft saves and restores after refresh.

## Prize Pool
- Top 1 requires one prize equal to total prize pool.
- Top 1 total 1 shows winner 1, fee 0.10, and total required 1.10 immediately.
- Top 1 has no separately editable stale 1st-place input.
- Top 3 requires three positive prizes.
- Top 3 Recommended total 10 shows 6 / 3 / 1.
- Top 3 Equal total 9 shows 3 / 3 / 3.
- Top 3 Equal total 10 shows 3.333334 / 3.333333 / 3.333333.
- Top 3 Custom 4 / 3 / 3 with total 10 is accepted.
- Top 3 Custom 5 / 5 / 5 with total 10 is rejected.
- Top 3 distribution must equal the total prize pool.
- Zero prize is rejected.
- More than 6 decimal places is rejected.
- Allocated and Remaining update immediately.
- Total required is rejected when it exceeds verified test USDC balance.
- Platform fee is calculated from the canonical 10% Brand-paid revenue model using 6-decimal integer units and ceiling rounding.
- Draft save/restore retains distribution mode and exact values.
- Funding request uses the same integer units displayed by the wizard.

## Deadlines
- Native calendar picker is available from each date field.
- Native time selector is available from each time field.
- User local timezone copy is displayed near the fields.
- Past submission deadline is rejected.
- Submission date/time less than 24 hours from now is rejected.
- Review date/time less than 24 hours after submission closes is rejected.
- Exact local date/time values persist after save and refresh.
- Local date/time values are converted to Unix seconds only server-side.

## Funding
- Initial state shows only Check Payment Account.
- Available balance displays Not checked before preflight.
- Review and Approve is absent before successful preflight.
- Failed preflight cannot continue to approval.
- Successful preflight shows the real verified test USDC balance.
- Insufficient balance blocks approval.
- Reconcile approval is hidden before an approval transaction exists.
- Reconcile funding is hidden before a funding transaction exists.
- Only one primary action appears per funding state.
- Refresh restores the correct funding state.
- Funding preflight cleanup does not submit a transaction.
- Circle 156003 stale transaction recovery removes only the invalid scoped transaction reference.
- 156003 recovery restores from on-chain allowance, funding status, and Brand balance.
- Normal UI hides raw HTTP status, Circle code, and transaction IDs.
- Existing Brand payment account is restored.
- Exact USDC approval is requested for total required amount only.
- Approval confirmation is reconciled before funding.
- Funding confirmation is reconciled before publish.
- Unknown transaction status can be reconciled by the existing challenge ID.
- Duplicate clicks reuse persisted idempotency keys and challenge ID.
- Existing funded challenge ID is rejected safely.
- Publish cannot be opened before complete funding verification.
- Restored `currentStep = publish` redirects to Funding without changing draft data.
- Approval pending disables duplicate approval actions.
- Funding pending disables duplicate funding actions.
- Verified funding enables Continue to Publish.

## Publish
- Challenge cannot be published before funding.
- ChallengeFunded event verification is required.
- `isFunded(challengeId)` must be true.
- Sponsor, amounts, deadlines, winner count, and distribution must match the draft.
- Published challenge loads from `/challenges/[slug]`.
- Step 5 has no generic Continue button.
- Step 5 has no Save Draft button.
- Publish Challenge is enabled only after verification guards pass.
- Successful publish shows View Challenge and Back to Dashboard.

## Fresh Draft Isolation
- Dashboard shows Draft Challenges and New Challenge as separate sections.
- Continue Draft opens only the selected draftId.
- Create New Challenge creates a new draftId, challengeId, and fundingIntentId.
- Create New Challenge starts from documented defaults.
- Create New Challenge does not inherit form fields, transaction metadata, funding state, or publication state.
- Previous drafts remain available after starting a new challenge.
- Refreshing a new draft does not load an older draft.
- Funded Sprint 4D challenge state is not altered.

## Security
- No userToken, encryptionKey, PIN, recovery data, API key, or signing secret is persisted.
- No raw Circle response is displayed.
- Internal routes remain outside public navigation.
- Local state is stored under ignored `.local/`.
- Unlimited approval is never requested.
- The previous Sprint 4D funded challenge is not reused.

## Regression
- Landing page remains unchanged.
- Logo remains unchanged.
- Existing challenge routes still work.
- Creator submission and blind review spikes still work.
- No payout, refund, or automatic funding occurs during implementation.
- Create Challenge uses the official logo and hides the marketing footer.
- Brand-visible Create Challenge UI avoids raw Circle and transaction details outside collapsed technical details.
