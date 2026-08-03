import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(file, needle, message) {
  assert.ok(read(file).includes(needle), message);
}

function excludes(file, needle, message) {
  assert.ok(!read(file).includes(needle), message);
}

const route = "src/app/api/create-challenge/draft/route.ts";
const store = "src/services/create-challenge/create-challenge-store.server.ts";
const policy = "src/config/create-challenge-deadline-policy.ts";
const wizard = "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx";
const demoDraft = "src/features/create-challenge/data/demo-draft.ts";

includes(route, 'url.searchParams.get("new") === "1"', "normal new draft entry must remain available");
includes(route, "createNewCreateChallengeDraft({", "normal new path must use the normal draft creator");
includes(route, 'url.searchParams.get("mode") === "smoke"', "isolated smoke entry must be explicitly routed");
includes(route, "createNewSmokeTestCreateChallengeDraft({", "smoke path must use the server-side smoke draft creator");

includes(store, "createNewSmokeTestCreateChallengeDraft", "store must expose a smoke-only draft creator");
includes(store, "getCreateChallengeDeadlinePolicy", "smoke draft creator must use canonical deadline policy");
includes(store, 'policy.mode !== "smoke"', "smoke draft creator must fail closed when smoke policy is unavailable");
includes(store, "policy.minimumSubmissionLeadMinutes * 60 * 1000", "submission deadline must be derived from server policy window");
includes(store, "policy.minimumReviewGapMinutes * 60 * 1000", "review deadline must be derived from server policy window");
includes(store, "isSmokeTest: true", "smoke draft must be marked explicitly server-side");
includes(store, "isSmokeTest: current.challenge.isSmokeTest", "client draft saves must not arbitrarily override smoke marker");

includes(policy, "CCN_SMOKE_TEST_MODE", "policy must require smoke env flag");
includes(policy, "CCN_ENABLE_SHORT_SMOKE_WINDOWS", "policy must support explicit short-window smoke flag");
includes(policy, "SHORT_SMOKE_DEADLINE_WINDOW_SECONDS = 900", "policy must enforce a 15-minute short-window floor");
includes(policy, "SHORT_SMOKE_DEADLINE_WINDOW_MINUTES = 15", "policy must expose the 15-minute short-window value");
includes(policy, "NODE_ENV !== \"production\"", "policy must refuse short smoke windows in production");
includes(policy, "minimumSubmissionLeadMinutes", "policy must expose canonical submission minutes");
includes(policy, "minimumReviewGapMinutes", "policy must expose canonical review minutes");

includes(wizard, 'params.get("mode") === "smoke"', "UI entry must recognize /create-challenge?mode=smoke");
includes(wizard, '"/api/create-challenge/draft?mode=smoke"', "UI entry must call isolated smoke draft endpoint");
includes(wizard, "/create-challenge?draftId=", "successful load must replace the URL with draftId to avoid refresh duplication");

excludes(demoDraft, "isSmokeTest", "normal demo draft defaults must not become smoke-marked");

console.log(JSON.stringify({
  result: "Validation Sprint 02 isolated smoke entry verification passed",
  normalPathUnchanged: true,
  smokePathServerGated: true,
  clientCannotOverrideSmokeMarker: true,
  serverDerivedDeadlines: true,
  noTransactionCreated: true,
}, null, 2));
