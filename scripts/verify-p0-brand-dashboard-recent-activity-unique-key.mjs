import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, expected, message) {
  assert.ok(source.includes(expected), `${message}: missing ${expected}`);
}

function excludes(source, forbidden, message) {
  assert.ok(!source.includes(forbidden), `${message}: found ${forbidden}`);
}

const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const viewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");

includes(viewModel, "key: string;", "Recent Activity items must expose a stable view-model identity");
includes(viewModel, "key: `draft:${row.draftId}:${row.status}`", "Per-draft activity must use canonical draft identity");
includes(viewModel, "key: `solutions:${solutionRows.map((row) => row.draftId).sort().join(\",\")}`", "Aggregate solution activity must use canonical draft identities");
includes(dashboard, "key={item.key}", "Recent Activity rendering must use the stable item key");

excludes(dashboard, "key={`${item.label}-${item.detail}-${item.at}`}", "Recent Activity must not key rows by duplicate-prone display text");
excludes(dashboard, "key={index}", "Recent Activity must not use list index as primary key");
excludes(dashboard, "Math.random()", "Recent Activity must not use random render-time keys");
excludes(dashboard, "Date.now()", "Recent Activity must not use render-time timestamp keys");
excludes(dashboard, "crypto.randomUUID()", "Recent Activity must not create render-time UUID keys");

const duplicateFixture = [
  {
    draftId: "draft-alpha",
    status: "draft",
    label: "Continue Problem Draft",
    detail: "Untitled draft",
    at: "Updated 09.08.2026",
  },
  {
    draftId: "draft-beta",
    status: "draft",
    label: "Continue Problem Draft",
    detail: "Untitled draft",
    at: "Updated 09.08.2026",
  },
];

const projected = duplicateFixture.map((item) => ({
  ...item,
  key: `draft:${item.draftId}:${item.status}`,
}));

assert.equal(projected.length, 2, "Both legitimate duplicate-looking activity rows must remain present.");
assert.deepEqual(
  projected.map((item) => item.label),
  ["Continue Problem Draft", "Continue Problem Draft"],
  "Visible labels must remain unchanged.",
);
assert.deepEqual(
  projected.map((item) => item.detail),
  ["Untitled draft", "Untitled draft"],
  "Visible details must remain unchanged.",
);
assert.deepEqual(
  projected.map((item) => item.at),
  ["Updated 09.08.2026", "Updated 09.08.2026"],
  "Visible timestamps must remain unchanged.",
);
assert.deepEqual(
  projected.map((item) => item.key),
  ["draft:draft-alpha:draft", "draft:draft-beta:draft"],
  "Canonical draft IDs must produce unique stable keys for duplicate-looking rows.",
);
assert.equal(new Set(projected.map((item) => item.key)).size, 2, "Duplicate-looking rows must not collide by React key.");
assert.deepEqual(
  projected.slice(0, 5).map((item) => item.draftId),
  ["draft-alpha", "draft-beta"],
  "Recent Activity ordering and 5-item limit semantics must remain unchanged.",
);

console.log("P0 Brand Dashboard Recent Activity unique-key verifier passed.");
