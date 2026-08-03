import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, text, message) {
  assert.ok(read(path).includes(text), message ?? `${path} must include ${text}`);
}

function excludes(path, text, message) {
  assert.ok(!read(path).includes(text), message ?? `${path} must not include ${text}`);
}

const canonical = "src/services/submissions/canonical-challenge-lifecycle.server.ts";
const winner = "src/services/create-challenge/winner-finalization.server.ts";
const blindRoute = "src/app/api/internal/blind-review/entries/route.ts";
const winnerRoute = "src/app/api/create-challenge/winner-finalization/route.ts";

includes(canonical, 'type LifecyclePhase = "submission" | "blind-review" | "winner-finalization" | "payout"',
  "canonical lifecycle must define explicit phase names");
includes(canonical, "nowSeconds?: number", "phase verifier must support deterministic timestamp tests");
includes(canonical, 'options.phase === "submission" && submissionDeadline && now >= submissionDeadline',
  "submission phase must close at submission deadline");
includes(canonical, 'options.phase === "blind-review" && submissionDeadline && now < submissionDeadline',
  "blind review must reject before submission close");
includes(canonical, 'options.phase === "winner-finalization" && submissionDeadline && now < submissionDeadline',
  "winner finalization must reject before submission close");
includes(canonical, 'if (reviewDeadline && now <= reviewDeadline) blockers.push("Review deadline has not passed.");',
  "payout phase must wait for review deadline");
includes(canonical, "verifyCanonicalChallengeForBlindReview", "blind review verifier must exist");
includes(canonical, "verifyCanonicalChallengeForWinnerFinalization", "winner finalization verifier must exist");
includes(canonical, "verifyCanonicalChallengeForPayout", "payout verifier must exist");
includes(canonical, "const challenge = await verifyCanonicalChallengeForBlindReview(input.draftId);",
  "blind review route path must not use submission-open verifier");
includes(canonical, "const challenge = await verifyCanonicalChallengeForWinnerFinalization(input.draftId);",
  "winner selection must not use submission-open verifier");
includes(winner, "verifyCanonicalChallengeForPayout", "payout service must import payout verifier");
includes(winner, "await assertPayoutPhaseReady(input.draftId);", "payout approval must be phase-gated");
includes(blindRoute, "listCanonicalBlindReviewEntries", "blind route must use canonical blind listing");
includes(winnerRoute, "selectedBlindEntryIds", "winner route must use blind entry IDs");
excludes(canonical, "listCanonicalBlindReviewEntries(input: { draftId: string }) {\n  const challenge = await verifyCanonicalChallengeForSubmission",
  "blind route must not use submission verifier");

console.log(JSON.stringify({
  result: "FAT-01R lifecycle phase separation static verification passed",
  phases: ["submission", "blind-review", "winner-finalization", "payout"],
  deterministicTimestampSupport: true,
}, null, 2));
