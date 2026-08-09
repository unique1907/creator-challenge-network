import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function excludes(source, needle, message) {
  assert.equal(source.includes(needle), false, message);
}

const landing = read("src/features/landing/components/final-landing-page.tsx");
const featured = read("src/features/landing/components/featured-challenge-card.tsx");
const projection = read("src/services/create-challenge/published-challenge.server.ts");
const payoutApproval = read("src/features/create-challenge/components/winner-finalization/payout-approval-client.tsx");
const winnerFinalizationApi = read("src/app/api/create-challenge/winner-finalization/route.ts");
const payments = read("src/app/dashboard/payments/page.tsx");
const wallet = read("src/app/dashboard/wallet/page.tsx");

excludes(landing, "Verified Settlement on Arc", "Standalone homepage settlement section heading must be removed.");
excludes(landing, "No verified public settlement yet", "Standalone homepage settlement empty state must be removed.");
excludes(landing, "Completed payout evidence will appear after a public challenge has a verified selected-solution payout.", "Standalone homepage settlement empty-state copy must be removed.");
excludes(landing, "settlementChallenge", "Homepage-only settlement projection variable must be removed.");
excludes(landing, "testnet.arcscan.app/tx/${settlementChallenge.payoutTransactionHash}", "Homepage-only settlement explorer link must be removed.");
excludes(landing, 'className="mx-auto max-w-7xl px-6 pb-16 sm:px-8 lg:px-10"', "Removed standalone settlement wrapper must not remain as an empty placeholder.");

includes(landing, "<LandingMetrics />", "Infrastructure proof strip must remain.");
includes(landing, "<ProcessStrip />", "How It Works/process strip must remain.");
includes(landing, 'id="live-business-challenges"', "Live Business Challenges section must remain.");
includes(landing, "<LandingAudienceSection authState={authState} />", "Audience section must move up naturally after live challenges.");

includes(featured, "Payout verified on Arc", "Featured Challenge payout proof pill must remain supported.");
includes(featured, "View Settlement", "Featured Challenge settlement action must remain supported.");
includes(featured, "testnet.arcscan.app/tx/${featured.payoutTransactionHash}", "Featured Challenge explorer link must remain available.");
includes(featured, "href={`/challenges/${featured.slug}`}", "Featured Challenge public route must remain intact.");

includes(projection, "payoutTransactionHash", "Shared public settlement projection must remain available.");
includes(projection, "listWinnerFinalizationAttempts", "Shared winner-finalization projection must remain available.");
includes(projection, "status === \"completed\" && winnerAttempt?.transactionHash", "Completed settlement links must still require payout evidence.");
includes(payoutApproval, "/api/create-challenge/winner-finalization", "Payout approval client must remain available outside the homepage.");
includes(payoutApproval, "Winner payout approval", "Payout approval UI must remain available outside the homepage.");
includes(winnerFinalizationApi, "payoutWalletId", "Winner-finalization payout API must remain available.");
includes(payments, "Payment", "Payments route must remain present.");
includes(wallet, "Wallet", "Wallet route must remain present.");

excludes(landing, "fetch(", "Homepage removal must not add product logic.");
excludes(landing, "/api/internal/circle", "Homepage removal must not add Circle calls.");
excludes(landing, "releasePayout", "Homepage removal must not add payout calls.");
excludes(landing, "executeContract", "Homepage removal must not add Arc state-changing calls.");

console.log("P0 public homepage settlement-section removal verifier passed.");
