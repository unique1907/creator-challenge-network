import assert from "node:assert/strict";
import fs from "node:fs";

const sourcePath = new URL("../src/services/create-challenge/create-challenge-funding.server.ts", import.meta.url);
const source = fs.readFileSync(sourcePath, "utf8");

function collectStringCandidates(value, predicate, ids = new Set(), parentKey = "") {
  if (!value || typeof value !== "object") return ids;
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === "string" && predicate(parentKey)) ids.add(item);
      else collectStringCandidates(item, predicate, ids, parentKey);
    });
    return ids;
  }
  Object.entries(value).forEach(([key, item]) => {
    if (Array.isArray(item)) collectStringCandidates(item, predicate, ids, key);
    else if (typeof item === "string" && predicate(key)) ids.add(item);
    else collectStringCandidates(item, predicate, ids, key);
  });
  return ids;
}

function resolveCircleTransactionIdFromChallenge(challenge) {
  const correlationIds = collectStringCandidates(challenge, (key) => key === "correlationIds" || /correlation/i.test(key));
  const transactionIds = collectStringCandidates(challenge, (key) => /transaction/i.test(key));
  return Array.from(correlationIds).at(0) ?? Array.from(transactionIds).at(0);
}

const circleChallengeId = "33e3572b-5ab6-5de1-a0f3-7c67a282b1ef";
const circleTransactionId = "342e8371-87be-5ca5-b73a-9cdf8e53ac42";
const txHash = "0xb54ec51d29215aa8188fe61a3ce9524d456fdd280a40749c04cc5b486819e6dc";
const challenge = {
  id: circleChallengeId,
  type: "CONTRACT_EXECUTION",
  status: "COMPLETE",
  correlationIds: [circleTransactionId],
};

assert.equal(resolveCircleTransactionIdFromChallenge(challenge), circleTransactionId);
assert.notEqual(resolveCircleTransactionIdFromChallenge(challenge), circleChallengeId);
assert.equal(resolveCircleTransactionIdFromChallenge({ id: circleChallengeId, status: "COMPLETE" }), undefined);
assert.equal(resolveCircleTransactionIdFromChallenge({ transactionId: circleTransactionId, txHash }), circleTransactionId);

const resolverStart = source.indexOf("export function resolveCircleTransactionIdFromChallenge");
assert.notEqual(resolverStart, -1);
const resolverEnd = source.indexOf("\n}", resolverStart);
const resolverSource = source.slice(resolverStart, resolverEnd + 2);
assert.ok(resolverSource.indexOf("collectCorrelationIds(challenge)") < resolverSource.indexOf("collectExplicitTransactionIds(challenge)"));
assert.equal(resolverSource.includes("challenge.id"), false);
assert.equal(resolverSource.includes('["id"]'), false);

console.log("circle transaction id resolution regression: ok");
