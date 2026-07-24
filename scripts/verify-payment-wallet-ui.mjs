import { readFileSync } from "node:fs";
import { join } from "node:path";

const wizardPath = join(
  process.cwd(),
  "src",
  "features",
  "create-challenge",
  "components",
  "real-flow",
  "create-challenge-wizard.tsx",
);
const source = readFileSync(wizardPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const cardUsages = [...source.matchAll(/<PaymentWalletCard\b/g)].length;
assert(cardUsages >= 2, "Prize & Winners and Secure Prize Pool must both render PaymentWalletCard.");
assert(source.includes("function PaymentWalletCard"), "PaymentWalletCard component must exist.");
assert(source.includes("walletAddressMasked"), "Payment wallet card must render the masked wallet address.");
assert(source.includes("navigator.clipboard.writeText(account.walletAddress)"), "Copy Address must copy the full wallet address.");
assert(!source.includes("navigator.clipboard.writeText(account.walletAddressMasked)"), "Copy Address must never copy the masked wallet address.");
assert(source.includes("Address copied"), "Copy Address success feedback must be visible.");
assert(source.includes("Could not copy address"), "Copy Address failure feedback must be visible.");
assert(source.includes("document.execCommand(\"copy\")"), "Copy Address must include a safe clipboard fallback.");
assert(source.includes("https://faucet.circle.com/"), "Add Test USDC must link to the official Circle Faucet.");
assert(!source.includes("https://faucet-v2.circle.com/"), "Add Test USDC must not use the old faucet-v2 URL.");
assert(source.includes("rel=\"noopener noreferrer\""), "External faucet link must use noopener noreferrer.");
assert(source.includes("account.explorerUrl"), "View on Arcscan must use the canonical account explorer URL.");
assert(source.includes("PaymentWalletCardAccount"), "Payment wallet card must consume the shared typed wallet object.");
assert(source.includes("Review and Approve {totalRequired}"), "Ready funding CTA must use Review and Approve copy.");
assert(!source.includes("Confirm payment {totalRequired}"), "Ready funding CTA must not use stale Confirm payment copy.");
const progressStart = source.indexOf("function paymentProgressItems");
const headerStart = source.indexOf("function paymentStateHeaderStatus");
const overviewStatusStart = source.indexOf("function paymentOverviewStatus");
assert(progressStart > -1, "Funding progress must derive from the canonical payment state.");
assert(headerStart > progressStart, "Funding header status must derive from the canonical payment state.");
assert(overviewStatusStart > headerStart, "Funding copy must derive from the canonical payment overview.");
const progressSegment = source.slice(progressStart, headerStart);
assert(progressSegment.includes("READY_FOR_APPROVAL"), "Progress derivation must represent approval-required state.");
assert(progressSegment.includes("APPROVED"), "Progress derivation must represent approved state.");
assert(progressSegment.includes("FUNDED_VERIFIED"), "Progress derivation must represent funded verified state.");
assert(source.includes("const fundingState: PaymentState = paymentOverview?.paymentState ?? \"NOT_STARTED\""), "UI must read funding state from the backend payment overview.");
assert(source.includes("const fundingSteps = paymentOverview?.progress ?? paymentProgressItems(fundingState)"), "UI must use backend progress or derive locally only from canonical state.");
assert(!progressSegment.includes("BigInt(preflight.allowance) >= BigInt(preflight.amounts.totalRequired)"), "Progress must not infer approval completion from allowance alone.");

const prizeStepIndex = source.indexOf("function PrizeStep");
const fundingStepIndex = source.indexOf("function FundingStep");
const cardDefinitionIndex = source.indexOf("function PaymentWalletCard");
assert(prizeStepIndex > -1 && fundingStepIndex > -1, "PrizeStep and FundingStep must exist.");

const prizeSegment = source.slice(prizeStepIndex, fundingStepIndex);
const fundingSegment = source.slice(fundingStepIndex, cardDefinitionIndex);
assert(prizeSegment.includes("<PaymentWalletCard"), "Prize & Winners must visibly show the payment wallet.");
assert(fundingSegment.includes("<PaymentWalletCard"), "Secure Prize Pool must visibly show the payment wallet.");

console.log("Payment wallet UI guard passed.");
