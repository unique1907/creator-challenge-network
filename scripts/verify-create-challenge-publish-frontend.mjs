import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wizard = fs.readFileSync(
  path.join(root, "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx"),
  "utf8",
);

assert.ok(wizard.includes("function publish()"), "publish handler must exist");
assert.ok(wizard.includes('tracePublishClick("publish-entered"'), "publish() entry must be traced in development");
assert.ok(wizard.includes('tracePublishClick("request-start"'), "publish request start must be traced");
assert.ok(wizard.includes('tracePublishClick("response-received"'), "publish response must be traced");
assert.ok(wizard.includes('tracePublishClick("catch"'), "publish catch must be traced");
assert.ok(wizard.includes('tracePublishClick("finally"'), "publish finally must be traced");
assert.ok(wizard.includes('"/api/create-challenge/publish"'), "publish handler must call the publish route");
assert.ok(wizard.includes("function handlePublishClick"), "PublishStep must use an explicit click wrapper");
assert.ok(wizard.includes('tracePublishClick("button-click"'), "button click must be traced before guards");
assert.ok(wizard.includes("event.preventDefault()"), "publish button click must prevent default browser form behavior");
assert.ok(wizard.includes("event.stopPropagation()"), "publish button click must avoid parent event interception");
assert.ok(wizard.includes("if (pending || !ready) return;"), "click wrapper must guard disabled states explicitly");
assert.ok(wizard.includes("onPublish();"), "click wrapper must call the onPublish prop");
assert.ok(wizard.includes('data-testid="publish-challenge-button"'), "publish button must expose a stable DOM test id");
assert.ok(wizard.includes('type="button"'), "publish button must be an inert button, not a submit button");
assert.ok(wizard.includes('onPublish={publish}'), "parent must pass publish handler to PublishStep");
assert.ok(wizard.includes("publishStepHeaderStatus(draft, status)"), "publish step header must derive from canonical draft publication state");
assert.ok(wizard.includes('return "Ready to publish";'), "ready-to-publish header must not use stale local status");
assert.ok(wizard.includes('showError(requestError, "PUBLISH")'), "backend publish errors must be scoped and rendered");

console.log("create challenge publish frontend regression: ok");
