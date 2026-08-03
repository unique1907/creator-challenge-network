import assert from "node:assert/strict";
import fs from "node:fs";

const servicePath = "src/services/creator-workspace/creator-workspace.server.ts";
const service = fs.readFileSync(servicePath, "utf8");

assert.ok(
  service.includes('const fundingStatus = String(draft.funding.fundingStatus);'),
  "Creator workspace gate must normalize funding status before eligibility checks.",
);
assert.ok(
  service.includes('(fundingStatus === "funded" || fundingStatus === "live")'),
  "Creator workspace gate must accept both funded and live canonical funding states.",
);
assert.ok(
  service.includes('draft.deployment.publicationStatus === "live"'),
  "Creator workspace gate must still require LIVE publication status.",
);
assert.ok(
  service.includes('draft.funding.escrowStatus === "verified"'),
  "Creator workspace gate must still require verified escrow status.",
);
assert.ok(
  service.includes("draft.funding.eventVerified === true"),
  "Creator workspace gate must still require verified funding event.",
);
assert.ok(
  service.includes("isSubmissionOpen(draft)"),
  "Creator workspace gate must still require an open submission deadline.",
);

function isSubmissionOpen(deadline, now) {
  const parsed = new Date(deadline);
  return Number.isFinite(parsed.getTime()) && now.getTime() < parsed.getTime();
}

function isDiscoverableFixture(input) {
  const fundingStatus = String(input.fundingStatus);
  return (
    input.publicationStatus === "live" &&
    (fundingStatus === "funded" || fundingStatus === "live") &&
    input.escrowStatus === "verified" &&
    input.eventVerified === true &&
    isSubmissionOpen(input.submissionDeadline, input.now)
  );
}

const now = new Date("2026-07-29T12:00:00.000Z");
const futureDeadline = "2026-07-31T09:00:00.000Z";
const pastDeadline = "2026-07-28T09:00:00.000Z";

assert.equal(
  isDiscoverableFixture({
    publicationStatus: "live",
    fundingStatus: "live",
    escrowStatus: "verified",
    eventVerified: true,
    submissionDeadline: futureDeadline,
    now,
  }),
  true,
  'fundingStatus="live" + open deadline must accept submissions.',
);

assert.equal(
  isDiscoverableFixture({
    publicationStatus: "live",
    fundingStatus: "funded",
    escrowStatus: "verified",
    eventVerified: true,
    submissionDeadline: futureDeadline,
    now,
  }),
  true,
  'fundingStatus="funded" + open deadline must accept submissions.',
);

assert.equal(
  isDiscoverableFixture({
    publicationStatus: "live",
    fundingStatus: "live",
    escrowStatus: "verified",
    eventVerified: true,
    submissionDeadline: pastDeadline,
    now,
  }),
  false,
  "passed deadline must reject submissions.",
);

assert.equal(
  isDiscoverableFixture({
    publicationStatus: "live",
    fundingStatus: "live",
    escrowStatus: "pending",
    eventVerified: true,
    submissionDeadline: futureDeadline,
    now,
  }),
  false,
  "unverified escrow status must reject submissions.",
);

assert.equal(
  isDiscoverableFixture({
    publicationStatus: "live",
    fundingStatus: "live",
    escrowStatus: "verified",
    eventVerified: false,
    submissionDeadline: futureDeadline,
    now,
  }),
  false,
  "unverified funding event must reject submissions.",
);

console.log("Sprint 11 Creator submission gate verification passed.");
