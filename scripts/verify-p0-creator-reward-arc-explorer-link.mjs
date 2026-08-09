import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const componentPath = "src/features/creator-workspace/components/creator-workspace.tsx";
const servicePath = "src/services/creator-workspace/creator-workspace.server.ts";

const component = fs.readFileSync(path.join(root, componentPath), "utf8");
const service = fs.readFileSync(path.join(root, servicePath), "utf8");

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

function excludes(source, text, message) {
  assert.ok(!source.includes(text), message);
}

includes(service, "transactionUrl: string | null", "Creator reward item must expose a canonical transaction URL.");
includes(service, "const ARC_EXPLORER_URL = \"https://testnet.arcscan.app\"", "Reward explorer URL must use the existing Arc Testnet explorer base.");
includes(service, "const transactionHash = paid ? attempt.transactionHash ?? null : null", "Reward transaction hash must come from the verified paid payout attempt.");
includes(service, "transactionUrl: transactionHash ? `${ARC_EXPLORER_URL}/tx/${transactionHash}` : null", "Reward transaction URL must use the full canonical hash.");
includes(service, "record.eventType === \"ChallengePayout\"", "Paid reward hash must remain tied to verified payout evidence.");
includes(service, "record.txHash.toLowerCase() === attempt.transactionHash?.toLowerCase()", "Payout evidence must match the canonical attempt transaction hash.");
includes(service, "record.receiptVerified", "Payout evidence must remain receipt-verified.");
includes(service, "record.eventVerified", "Payout evidence must remain event-verified.");
includes(service, "record.winnersVerified", "Payout evidence must remain winner-verified.");

includes(component, "href={reward.transactionUrl}", "Reward row must link to the canonical full transaction URL.");
includes(component, "target=\"_blank\"", "Reward transaction link must open in a new tab.");
includes(component, "rel=\"noopener noreferrer\"", "Reward transaction link must use safe external-link rel attributes.");
includes(component, "{maskId(reward.transactionHash)}", "Reward row must preserve the existing shortened hash display.");
includes(component, "reward.transactionHash && reward.transactionUrl", "Reward row must require a real hash and URL before rendering a link.");
includes(component, "<p className=\"text-slate-400\">No verified tx</p>", "Missing payout hash must keep the safe no-link fallback.");

excludes(component, "0x7ae465", "Reward row must not hardcode the demo transaction hash.");
excludes(service, "Deneme 4", "Reward projection must not hardcode the demo challenge title.");

console.log("P0 Creator reward Arc explorer link verifier passed.");
