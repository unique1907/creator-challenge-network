import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.CCN_TEST_BASE_URL ?? "http://localhost:3000";
const canonicalStore = ".local/create-challenge-flow.json";
const submissionStore = ".local/internal-submissions-spike.json";
const manualStore = ".local/manual-creator-ux-01-1.json";
const manualAssetDir = ".local/manual-creator-assets";

function full(rel) {
  return path.join(root, rel);
}

function read(rel) {
  return fs.readFileSync(full(rel), "utf8");
}

function hashIfExists(rel) {
  if (!fs.existsSync(full(rel))) return "missing";
  return createHash("sha256").update(fs.readFileSync(full(rel))).digest("hex");
}

function assertIncludes(file, needle, message) {
  assert.ok(read(file).includes(needle), message);
}

function assertExcludes(file, needle, message) {
  assert.ok(!read(file).includes(needle), message);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { text };
  }
  return { response, text, json };
}

async function postJson(pathname, body = {}, cookie = "") {
  return request(pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function signIn() {
  const response = await postJson("/api/creator/session", { ccnAccountId: "ccn-test-creator-001" });
  assert.equal(response.response.status, 200, "Demo Creator sign-in must succeed");
  const cookie = response.response.headers.get("set-cookie");
  assert.ok(cookie?.includes("ccn_creator_session="), "Creator session cookie must be set");
  return cookie.split(";")[0];
}

async function upload(name, type, content, cookie) {
  const form = new FormData();
  form.set("file", new File([content], name, { type }));
  return request("/api/internal/submissions/manual-fixture/upload", {
    method: "POST",
    headers: { cookie },
    body: form,
  });
}

assertIncludes(
  "src/services/submissions/manual-creator-fixture.server.ts",
  "ASSET_DIR = join(process.cwd(), \".local\", \"manual-creator-assets\")",
  "manual fixture uploads must live outside public source directories",
);
assertIncludes(
  "src/services/submissions/manual-creator-fixture.server.ts",
  "storageKey = `manual-fixture/${id}${extension}`",
  "manual fixture uploads must use generated storage keys",
);
assertIncludes(
  "src/services/submissions/manual-creator-fixture.server.ts",
  "Filename is not allowed.",
  "manual fixture upload must reject path traversal-style filenames",
);
assertIncludes(
  "src/services/submissions/manual-creator-fixture.server.ts",
  "MAX_FILES = 5",
  "manual fixture must enforce a max file count",
);
assertIncludes(
  "src/services/submissions/manual-creator-fixture.server.ts",
  "MAX_TOTAL_BYTES = 250 * 1024 * 1024",
  "manual fixture must enforce total upload size",
);
assertIncludes(
  "src/features/creator-submission-spike/components/manual-creator-fixture-client.tsx",
  "Submit entry",
  "manual fixture must expose one-step submit",
);
assertIncludes(
  "src/features/creator-submission-spike/components/manual-creator-fixture-client.tsx",
  "Manual fixture reset. Sign in again to start fresh.",
  "reset must return the UI to the sign-in gate without refresh",
);
assertIncludes(
  "src/services/submissions/submission-store.server.ts",
  "assets: submission.assets ?? []",
  "blind review projection must include identity-free asset references",
);
assertExcludes(
  "src/services/submissions/manual-creator-fixture.server.ts",
  "createProductFundingChallenge",
  "manual fixture must not import funding code",
);
assertExcludes(
  "src/services/submissions/manual-creator-fixture.server.ts",
  "releasePayout",
  "manual fixture must not import payout code",
);

const canonicalBefore = hashIfExists(canonicalStore);
const submissionsBefore = hashIfExists(submissionStore);

const reset = await postJson("/api/internal/submissions/manual-fixture/reset");
assert.equal(reset.response.status, 200, "reset must be available in development smoke mode");

const cookie = await signIn();

const uploadResponse = await upload("hero-concept.png", "image/png", "fake png bytes", cookie);
assert.equal(uploadResponse.response.status, 200, "supported image upload must succeed");
assert.equal(uploadResponse.json.asset.type, "FILE");
assert.equal(uploadResponse.json.asset.displayName, "hero-concept.png");
assert.ok(uploadResponse.json.asset.storageKey.startsWith("manual-fixture/"), "upload must return only a relative storage key");
assert.ok(!path.isAbsolute(uploadResponse.json.asset.storageKey), "upload response must not expose an absolute path");
assert.ok(uploadResponse.json.asset.reviewUrl.startsWith("/api/internal/submissions/manual-fixture/assets/"));

const blockedUpload = await upload("../secret.exe", "application/octet-stream", "bad", cookie);
assert.equal(blockedUpload.response.status, 400, "unsupported/path-like upload must fail safely");

const draft = await postJson(
  "/api/internal/submissions/manual-fixture/draft",
  {
    title: "Manual Asset Submission",
    description: "A safe file-backed Creator submission acceptance fixture.",
    primaryAssetUrl: "",
    supportingLinks: ["https://example.com/supporting-context"],
    assets: [uploadResponse.json.asset],
  },
  cookie,
);
assert.equal(draft.response.status, 200, "draft with uploaded asset must save");
assert.equal(draft.json.submission.status, "DRAFT");
assert.equal(draft.json.submission.assets.length, 1);
assert.equal(draft.json.submission.assets[0].type, "FILE");

const refresh = await postJson("/api/internal/submissions/manual-fixture/status", {}, cookie);
assert.equal(refresh.json.submission.assets[0].id, uploadResponse.json.asset.id, "refresh must preserve uploaded asset metadata");

const finalized = await postJson(
  "/api/internal/submissions/manual-fixture/finalize",
  { idempotencyKey: "ux-01-2-one-step-submit" },
  cookie,
);
assert.equal(finalized.response.status, 200, "finalize must succeed after latest saved asset draft");
assert.equal(finalized.json.submission.status, "SUBMITTED");
assert.equal(finalized.json.submission.assets[0].id, uploadResponse.json.asset.id);

const immutable = await postJson(
  "/api/internal/submissions/manual-fixture/draft",
  {
    title: "Mutation after one-step submit",
    description: "Should fail",
    primaryAssetUrl: "https://example.com/mutation",
    supportingLinks: [],
    assets: [],
  },
  cookie,
);
assert.equal(immutable.response.status, 400, "finalized asset submission must be immutable");

assert.equal(hashIfExists(canonicalStore), canonicalBefore, "asset fixture must not modify create-challenge-flow store");
assert.equal(hashIfExists(submissionStore), submissionsBefore, "asset fixture must not modify canonical/internal submission store");
assert.ok(fs.existsSync(full(manualStore)), "manual fixture store should contain only local fixture state");
assert.ok(fs.existsSync(full(manualAssetDir)), "manual fixture uploaded file should be stored only in local asset directory");

const resetAfter = await postJson("/api/internal/submissions/manual-fixture/reset");
assert.equal(resetAfter.response.status, 200, "manual fixture reset must clear asset test state");
assert.ok(!fs.existsSync(full(manualAssetDir)) || fs.readdirSync(full(manualAssetDir)).length === 0, "reset must clear only manual uploaded assets");
assert.equal(hashIfExists(canonicalStore), canonicalBefore, "reset must not modify create-challenge-flow store");
assert.equal(hashIfExists(submissionStore), submissionsBefore, "reset must not modify canonical/internal submission store");

console.log(JSON.stringify({
  result: "UX-01.2 manual Creator asset upload verification passed",
  uploadRoute: "/api/internal/submissions/manual-fixture/upload",
  manualRoute: "/submit/manual-test-fixture",
  storedOutsidePublic: true,
  oneStepSubmit: true,
  canonicalStoresUnchanged: true,
}, null, 2));
