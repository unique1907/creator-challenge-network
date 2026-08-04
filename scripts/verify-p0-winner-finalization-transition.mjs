import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const workspace = read("src/features/dashboard/components/campaign-workspace.tsx");
const tabs = read("src/features/dashboard/components/campaign-workspace-tabs.tsx");
const route = read("src/app/api/dashboard/finalize-review/route.ts");

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

function excludes(source, text, message) {
  assert.ok(!source.includes(text), message);
}

includes(workspace, 'if (winnerAttempt?.finalizedAt) return "settlement";', "finalized winner must advance lifecycle to Settlement.");
includes(workspace, 'if (winnerAttempt?.state === "READY_FOR_FINAL_SELECTION") return "winner";', "selection-ready state without finalizedAt must remain Selection.");
includes(workspace, 'actions.push({ label: "Finalize Winner", href: "#finalize-review", primary: true });', "Selection next action must finalize the winner.");
includes(workspace, '} else if (state === "settlement") {\n    actions.push({ label: "Approve Payout"', "Approve Payout must only be exposed from Settlement.");
excludes(workspace, 'state === "winner" || winnerAttempt?.state === "READY_FOR_FINAL_SELECTION"', "READY_FOR_FINAL_SELECTION alone must not expose payout.");

includes(tabs, "selectedWinnerEntryIds", "review tab must carry the selected proposal into finalization.");
includes(tabs, "winnerCount === 1 ? [selectedEntry?.blindEntryId]", "single-winner flow must finalize the explicitly selected proposal.");
includes(tabs, "body: JSON.stringify({ draftId, selectedBlindEntryIds: selectedWinnerEntryIds })", "client must send selected winner IDs to the finalize route.");
includes(tabs, "Finalize Winner", "UI must show an explicit winner finalization action.");
includes(tabs, "Winner finalized. Selected solution is locked for payout preparation.", "success state must confirm selected solution persistence.");
includes(tabs, "onFinalized(codes)", "client must lock review state after successful persistence.");
includes(tabs, "router.refresh()", "workspace must refresh server state after finalization.");
includes(tabs, "Initiate PAYOUT Approval", "payout approval UI must remain present for Settlement.");
includes(tabs, 'mode: "create-approval"', "payout approval flow must remain unchanged and separate.");

includes(route, "await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);", "finalize route must verify Brand ownership.");
includes(route, "selectedBlindEntryIdsFromBody(body.selectedBlindEntryIds)", "finalize route must read explicit selected winners.");
includes(route, "requestedBlindEntryIds ?? [...entries]", "finalize route may only fall back when no explicit selection is provided.");
includes(route, "Exactly ${draft.prizePool.winnerCount}", "finalize route must validate winner count.");
includes(route, "Duplicate winner selections are not allowed.", "finalize route must reject duplicate selections.");
includes(route, "Selected winner is not available for this challenge.", "finalize route must reject malformed selections.");
includes(route, "resolveCanonicalWinnerSelection", "finalize route must use canonical winner validation.");
includes(route, "finalizeWinnerSelection", "finalize route must persist winner finalization.");
excludes(route, "create-approval", "finalize route must not create payout approval.");
excludes(route, "releasePayout", "finalize route must not execute payout.");

console.log(JSON.stringify({
  result: "P0 winner finalization transition verification passed",
  selectionBeforeFinalization: "Finalize Winner",
  settlementAfterFinalizedAt: true,
  explicitWinnerSelection: true,
  payoutBeforeFinalization: false,
  payoutExecutionTouched: false,
}, null, 2));
