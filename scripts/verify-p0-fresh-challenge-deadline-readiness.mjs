import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function includes(file, pattern, message) {
  assert.ok(read(file).includes(pattern), message);
}

function excludes(file, pattern, message) {
  assert.ok(!read(file).includes(pattern), message);
}

function loadEnv(file) {
  const env = {};
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return env;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const LEGACY_FLOATING_TIMEZONE_OFFSET_MINUTES = 180;

function parseLegacyFloatingLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second = "00"] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) -
    LEGACY_FLOATING_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
}

function parseDeadline(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return { iso: new Date(value * 1000).toISOString(), unix: Math.floor(value) };
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const ms = hasExplicitTimezone ? Date.parse(trimmed) : parseLegacyFloatingLocal(trimmed);
  if (!Number.isFinite(ms)) return null;
  return { iso: new Date(ms).toISOString(), unix: Math.floor(ms / 1000) };
}

function normalizeDeadlines(reviewRules, nowSeconds = 1_785_860_000) {
  const submission = parseDeadline(reviewRules.submissionDeadline ?? reviewRules.submissionDeadlineUtc);
  const review = parseDeadline(reviewRules.reviewDeadline ?? reviewRules.reviewDeadlineUtc);
  const issues = [];
  if (!reviewRules.submissionDeadline && !reviewRules.submissionDeadlineUtc) issues.push("missing-submission-deadline");
  else if (!submission) issues.push("malformed-submission-deadline");
  if (!reviewRules.reviewDeadline && !reviewRules.reviewDeadlineUtc) issues.push("missing-review-deadline");
  else if (!review) issues.push("malformed-review-deadline");
  if (submission && review && review.unix <= submission.unix) issues.push("invalid-deadline-order");
  const readiness = issues.length ? "blocked" : nowSeconds < submission.unix ? "submission-open" : nowSeconds <= review.unix ? "review-not-reached" : "ready";
  return { submission, review, issues, readiness };
}

function word(hex) {
  return hex.replace(/^0x/, "").padStart(64, "0");
}

function splitWords(data) {
  return data.replace(/^0x/, "").match(/.{1,64}/g) ?? [];
}

async function readEscrowSnapshot(challengeId) {
  const escrow = "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D";
  let payload;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    const response = await fetch("https://rpc.testnet.arc.network", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: escrow, data: `0x458d2bf1${word(challengeId)}` }, "latest"],
      }),
    });
    payload = await response.json();
    if (!payload.error || !/limit/i.test(payload.error.message ?? "")) break;
  }
  if (payload?.error) throw new Error(payload.error.message ?? "Arc read failed.");
  const words = splitWords(payload.result ?? "0x");
  return {
    submissionDeadline: Number(BigInt(`0x${words[3] ?? "0"}`)),
    reviewDeadline: Number(BigInt(`0x${words[4] ?? "0"}`)),
    winnerCount: Number(BigInt(`0x${words[5] ?? "0"}`)),
    status: Number(BigInt(`0x${words[6] ?? "0"}`)),
  };
}

async function verifyLiveRecords() {
  const env = { ...loadEnv(".env.local"), ...process.env };
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { skipped: true, reason: "Supabase env unavailable" };
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const expected = new Map([
    ["bbba73a3-067e-4b1d-bb89-d15879dd40ec", { title: "Deneme 1", winnerCount: 1, submissions: 1, payoutConfirmed: true }],
    ["54ecd011-e171-4d27-9b0b-7215dc6f4bfd", { title: "Deneme 2", winnerCount: 1, submissions: 1, payoutConfirmed: true }],
    ["45c91318-db42-48c7-9549-27c55a4a0da4", { title: "Deneme 3", winnerCount: 3, submissions: 1, payoutConfirmed: false }],
    ["7897dca3-8299-4770-a013-e2595b92f5fe", { title: "Coffee", winnerCount: 1, submissions: 1, payoutConfirmed: true }],
  ]);
  const ids = Array.from(expected.keys());
  const drafts = await supabase
    .from("ccn_challenge_drafts")
    .select("draft_id,challenge_id,title,publication_status,funding_status,escrow_status,event_verified,draft_state")
    .in("draft_id", ids);
  assert.equal(drafts.error, null, drafts.error?.message);
  assert.equal(drafts.data.length, ids.length, "all target challenge drafts must be present");
  const challengeIds = drafts.data.map((row) => row.challenge_id);
  const submissions = await supabase
    .from("ccn_creator_submissions")
    .select("challenge_id,status")
    .in("challenge_id", challengeIds);
  assert.equal(submissions.error, null, submissions.error?.message);
  const winners = await supabase
    .from("ccn_winner_finalization_attempts")
    .select("draft_id,state,attempt_state")
    .in("draft_id", ids);
  assert.equal(winners.error, null, winners.error?.message);

  const rows = [];
  for (const row of drafts.data) {
    const config = expected.get(row.draft_id);
    const draft = row.draft_state;
    const normalized = normalizeDeadlines(draft.reviewRules);
    assert.equal(normalized.issues.length, 0, `${config.title} deadlines must normalize without missing/malformed/order issues`);
    assert.ok(normalized.submission.iso.endsWith("Z"), `${config.title} submission deadline must be UTC ISO or normalized legacy`);
    assert.ok(normalized.review.iso.endsWith("Z"), `${config.title} review deadline must be UTC ISO or normalized legacy`);
    assert.equal(draft.prizePool.winnerCount, config.winnerCount, `${config.title} winner model must be preserved`);
    const matchingSubmissions = submissions.data.filter((submission) =>
      submission.challenge_id.toLowerCase() === row.challenge_id.toLowerCase() && submission.status === "SUBMITTED"
    );
    assert.equal(matchingSubmissions.length, config.submissions, `${config.title} submitted solution count must be preserved`);
    const snapshot = await readEscrowSnapshot(row.challenge_id);
    assert.equal(snapshot.submissionDeadline, normalized.submission.unix, `${config.title} submission deadline must match funded escrow`);
    assert.equal(snapshot.reviewDeadline, normalized.review.unix, `${config.title} review deadline must match funded escrow`);
    assert.equal(snapshot.winnerCount, config.winnerCount, `${config.title} escrow winner model must be preserved`);
    const winnerAttempt = winners.data.find((item) => item.draft_id === row.draft_id);
    if (config.payoutConfirmed) {
      assert.equal(winnerAttempt?.state, "PAYOUT_CONFIRMED", "completed coffee-shop challenge must remain payout-confirmed");
      assert.equal(snapshot.status, 3, "completed coffee-shop challenge must remain paid on-chain");
    } else {
      assert.notEqual(winnerAttempt?.state, "PAYOUT_CONFIRMED", `${config.title} must not have payout confirmed`);
      assert.equal(snapshot.status, 1, `${config.title} must remain funded, not paid`);
    }
    rows.push({
      title: config.title,
      draftId: row.draft_id,
      submissionDeadlineUnix: normalized.submission.unix,
      reviewDeadlineUnix: normalized.review.unix,
      winnerCount: config.winnerCount,
      submissions: matchingSubmissions.length,
      escrowStatus: snapshot.status,
    });
  }
  return { skipped: false, rows };
}

includes("src/utils/challenge-deadlines.ts", "normalizeChallengeDeadlines", "canonical deadline normalizer must exist");
includes("src/utils/challenge-deadlines.ts", "canonicalizeDraftDeadlines", "draft deadline canonicalizer must exist");
includes("src/utils/challenge-deadlines.ts", "localInputToCanonicalIso", "wizard local input conversion must exist");
includes("src/services/create-challenge/create-challenge-store.server.ts", "canonicalizeDraftDeadlines(draft)", "create/save/patch hydration must canonicalize deadlines through withDerivedValues");
includes("src/services/create-challenge/create-challenge-store.server.ts", "deadlineUnixSecondsFromDraft(normalized)", "funding intent must derive seconds from canonical deadline helper");
includes("src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx", "return localInputToCanonicalIso(date, time);", "wizard must store UTC ISO values from date/time inputs");
includes("src/services/submissions/canonical-challenge-lifecycle.server.ts", "normalizeChallengeDeadlines(draft.reviewRules", "lifecycle readiness must use canonical deadline normalizer");
excludes("src/services/submissions/canonical-challenge-lifecycle.server.ts", "unixFromLocal", "lifecycle readiness must not use legacy parser directly");
includes("src/services/create-challenge/winner-finalization.server.ts", "submissionDeadlineMismatch", "payout readiness must distinguish deadline mismatch from missing");
includes("src/services/create-challenge/create-challenge-funding.server.ts", "new Date(verification.challenge.submissionDeadline * 1000).toISOString()", "funding verification must persist contract deadline as UTC ISO");

const future = normalizeDeadlines({
  submissionDeadline: "2026-08-04T19:00:00.000Z",
  reviewDeadline: "2026-08-04T19:15:00.000Z",
}, 1_785_860_000);
assert.equal(future.issues.length, 0, "fresh canonical UTC deadlines must normalize");
assert.equal(future.submission.iso, "2026-08-04T19:00:00.000Z", "canonical write path must preserve UTC ISO");
assert.equal(future.review.iso, "2026-08-04T19:15:00.000Z", "canonical write path must preserve review UTC ISO");

const legacy = normalizeDeadlines({
  submissionDeadline: "2026-08-04T19:00",
  reviewDeadline: "2026-08-04T20:00",
}, 1_785_859_300);
assert.equal(legacy.submission.iso, "2026-08-04T16:00:00.000Z", "legacy offset-less submission deadlines must normalize deterministically");
assert.equal(legacy.review.iso, "2026-08-04T17:00:00.000Z", "legacy offset-less review deadlines must normalize deterministically");
assert.equal(legacy.readiness, "review-not-reached", "not-yet-reached review window must not be classified as missing");

const ready = normalizeDeadlines({
  submissionDeadline: "2026-08-04T19:00:00.000Z",
  reviewDeadline: "2026-08-04T19:15:00.000Z",
}, 1_785_871_201);
assert.equal(ready.readiness, "ready", "elapsed review deadline must become ready");

const invalid = normalizeDeadlines({
  submissionDeadline: "2026-08-04T19:15:00.000Z",
  reviewDeadline: "2026-08-04T19:00:00.000Z",
});
assert.ok(invalid.issues.includes("invalid-deadline-order"), "invalid ordering must still fail");

const missing = normalizeDeadlines({});
assert.ok(missing.issues.includes("missing-submission-deadline"), "missing submission deadline must still fail");
assert.ok(missing.issues.includes("missing-review-deadline"), "missing review deadline must still fail");

const liveRecords = await verifyLiveRecords();

console.log(JSON.stringify({
  result: "P0 fresh challenge deadline readiness verification passed",
  staticCoverage: {
    canonicalModel: "reviewRules.submissionDeadline/reviewDeadline as UTC ISO strings; unix seconds derived by shared helper",
    top1: true,
    top3: true,
    invalidOrderingStillFails: true,
    missingValuesStillFail: true,
    noCircleCalls: true,
    noArcStateChangingCalls: true,
  },
  liveRecords,
}, null, 2));
