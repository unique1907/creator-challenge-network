import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeStorePath =
  process.env.CCN_CREATE_CHALLENGE_RUNTIME_STORE_PATH ??
  path.join(root, ".local", "create-challenge-flow.json");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function sha256(file) {
  return fs.existsSync(file)
    ? crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
    : "missing";
}

function functionSource(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  const start = match?.index ?? -1;
  assert.notEqual(start, -1, `${name} must exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  const nextExport = source.indexOf("\nexport ", start + 1);
  const candidates = [nextFunction, nextExport].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

const beforeHash = sha256(runtimeStorePath);
const store = read("src/services/create-challenge/create-challenge-store.server.ts");

assert.ok(store.includes("class StoreCorruptionError"), "corrupt JSON must produce an explicit store error");
assert.ok(store.includes("class StoreConflictError"), "stale writers must be rejected or retried");
assert.ok(store.includes("CCN_CREATE_CHALLENGE_STORE_PATH"), "store path must be configurable for isolated tests");
assert.ok(store.includes(".create-challenge-flow.") && store.includes("rename(tempPath, CREATE_CHALLENGE_STORE_PATH)"), "writes must use a unique temp file and atomic rename");
assert.ok(store.includes("handle.sync()"), "atomic writes must flush the temp file before replace");
assert.ok(store.includes("validateStoreShape(JSON.parse(await readFile(tempPath"), "temp file must be parsed before replace");
assert.ok(store.includes("last-known-good.json"), "successful writes must maintain last-known-good backup");
assert.ok(store.includes("revision") && store.includes("expectedRevision"), "writes must use a revision guard");

const readStoreSource = functionSource(store, "readStore");
assert.equal(readStoreSource.includes("return {};"), false, "read failure must never become empty store");
assert.ok(readStoreSource.includes("StoreCorruptionError"), "readStore must throw corruption errors for existing unreadable files");

const normalizeSource = functionSource(store, "normalizeStore");
assert.equal(normalizeSource.includes("writeStore("), false, "normalizeStore must not write");
assert.equal(normalizeSource.includes("updateStore("), false, "normalizeStore must not write through updateStore");

const getDraftSource = store.slice(store.indexOf("export async function getCreateChallengeDraft"), store.indexOf("export async function getCreateChallengeDraftStrict"));
assert.ok(getDraftSource.includes("DraftNotFoundError"), "unknown draft must throw DraftNotFoundError");
assert.equal(getDraftSource.includes("createNewCreateChallengeDraft()"), false, "unknown draft must not create a new draft");
assert.equal(getDraftSource.includes("store.activeDraftId"), false, "exact draft reads must not fall back to activeDraftId");

const published = read("src/services/create-challenge/published-challenge.server.ts");
assert.ok(published.includes("listCreateChallengeDrafts"), "public reads must list drafts rather than load active draft");
assert.equal(published.includes("getCreateChallengeDraft()"), false, "public reads must not call draft lookup without an id");

const overviewRoute = read("src/app/api/create-challenge/payment-overview/route.ts");
assert.ok(overviewRoute.includes("requireSearchDraftId"), "payment-overview must require exact draftId");

for (const script of [
  "scripts/verify-create-challenge-payment-engine.mjs",
  "scripts/verify-circle-transaction-id-resolution.mjs",
]) {
  const source = read(script);
  assert.equal(source.includes(".local/create-challenge-flow.json"), false, `${script} must not read the runtime store`);
  assert.equal(source.includes("create-challenge-flow.json"), false, `${script} must not write the runtime store`);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ccn-store-safety-"));
const tempStore = path.join(tempRoot, "create-challenge-flow.json");
const payload = { version: 1, revision: 1, drafts: { a: { id: "safe" } } };
const tmp = `${tempStore}.${process.pid}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
assert.deepEqual(JSON.parse(fs.readFileSync(tmp, "utf8")), payload, "temp payload must be parseable before replace");
fs.renameSync(tmp, tempStore);
assert.deepEqual(JSON.parse(fs.readFileSync(tempStore, "utf8")), payload, "atomic temp replace simulation must preserve payload");
fs.rmSync(tempRoot, { recursive: true, force: true });

const afterHash = sha256(runtimeStorePath);
assert.equal(afterHash, beforeHash, "store-safety verification must not mutate the runtime store");

console.log(JSON.stringify({
  result: "create challenge store safety regression: ok",
  runtimeStorePath,
  runtimeStoreHashBefore: beforeHash,
  runtimeStoreHashAfter: afterHash,
}));
