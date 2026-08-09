import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const failures = [];
function expectContains(file, text) {
  if (!read(file).includes(text)) failures.push(`${file} must contain: ${text}`);
}
function expectNotContains(file, text) {
  if (read(file).includes(text)) failures.push(`${file} must not contain: ${text}`);
}

const files = {
  hero: "src/features/landing/components/final-landing-page.tsx",
  featured: "src/features/landing/components/featured-challenge-card.tsx",
  challengeCard: "src/features/challenges/components/challenge-card.tsx",
  challengeDetail: "src/features/challenges/components/challenge-detail.tsx",
  createWizard: "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx",
  readiness: "src/utils/create-challenge-launch-readiness.ts",
  fundingServer: "src/services/create-challenge/create-challenge-funding.server.ts",
  winnerServer: "src/services/create-challenge/winner-finalization.server.ts",
  creatorWorkspace: "src/features/creator-workspace/components/creator-workspace.tsx",
  creatorActions: "src/features/creator-workspace/components/creator-actions.tsx",
  creatorGuide: "src/app/dashboard/creator/guide/page.tsx",
  brandDashboard: "src/features/dashboard/components/brand-dashboard.tsx",
  brandChallenges: "src/features/dashboard/components/brand-dashboard-challenges.tsx",
  brandWorkspace: "src/features/dashboard/components/campaign-workspace.tsx",
  brandWorkspaceTabs: "src/features/dashboard/components/campaign-workspace-tabs.tsx",
  authActions: "src/features/auth/components/auth-actions.tsx",
  signIn: "src/app/auth/sign-in/page.tsx",
  signUp: "src/app/auth/sign-up/page.tsx",
  signUpEntry: "src/features/auth/components/sign-up-entry.tsx",
  aboutArc: "src/app/dashboard/about-arc/page.tsx",
};

// Locked hero positioning must remain untouched.
expectContains(files.hero, "Discover the World&apos;s Best Ideas.");
expectContains(files.hero, "Turn business problems into winning solutions.");
expectContains(files.hero, "Launch a business challenge, receive solutions from a global network of AI-augmented creators, and reward the best outcome.");

// Approved replacements present.
expectContains(files.createWizard, "Challenge Category");
expectContains(files.createWizard, "Specify category");
expectContains(files.createWizard, "Payment provider error. Technical code:");
expectContains(files.createWizard, "Review and fund Prize Pool");
expectContains(files.createWizard, "Check wallet balance");
expectContains(files.createWizard, "Technical funding details");
expectContains(files.creatorActions, "Submit Solution Proposal");
expectContains(files.creatorWorkspace, "Choose an open Business Challenge to create your first Solution Proposal.");
expectContains(files.creatorWorkspace, "Verified on Arc Testnet");
expectContains(files.creatorWorkspace, "Winner and payout evidence will appear here after settlement is complete.");
expectContains(files.creatorGuide, "Drafts and submitted proposals stay tied to their Business Challenge.");
expectContains(files.brandDashboard, "Turn business problems into solutions you can review and reward.");
expectContains(files.brandDashboard, "New Business Challenge");
expectContains(files.brandDashboard, "Challenge Progress");
expectContains(files.brandChallenges, "Business Challenges");
expectContains(files.brandWorkspace, "Challenge Status");
expectContains(files.brandWorkspace, "Arc contract");
expectContains(files.brandWorkspaceTabs, "No action is available for this Business Challenge right now.");
expectContains(files.featured, "Prize Pool Funded");
expectContains(files.featured, "Payout verified on Arc");
expectContains(files.challengeDetail, "Prize Pool on Arc");
expectContains(files.challengeDetail, "View Arc contract");
expectContains(files.signIn, "We could not verify that email link.");
expectContains(files.authActions, "This sign-in option is not available right now.");
expectContains(files.signUpEntry, "Account type");
expectContains(files.signUp, "Finish account setup before opening your dashboard.");

// Approved old copy absent from active UI/source surfaces.
const bannedByFile = new Map([
  [files.createWizard, [
    "Business Domain",
    "Specify business domain",
    "Canonical preflight",
    "USDC allowance",
    "Canonical funding intent",
    "Canonical verification",
    "Publish API",
    "Circle Code",
    "Review & Launch",
    "Check Payment Account",
    "Checking campaign readiness, wallet and allowance request.",
    "Development funding scope",
    "Needs campaign details",
    "Fix campaign details",
  ]],
  [files.readiness, ["Business Domain", "Specify business domain"]],
  [files.creatorActions, ["Finalize Submission", "Continue as Demo Creator"]],
  [files.creatorWorkspace, ["Choose an open challenge to create your first entry.", "Balance source", "Arc Testnet RPC", "canonical settlement"]],
  [files.creatorGuide, ["Drafts and finalized entries", "canonical Business Challenge"]],
  [files.brandDashboard, ["New Draft", "Solution Journey", "evaluated solutions and settlement-ready outcomes"]],
  [files.brandChallenges, ["workspace records from your CCN workspace"]],
  [files.brandWorkspace, ["Campaign Health", "Runtime Contract", "Search campaigns, creators...", "Untitled campaign", "Lifecycle Timeline"]],
  [files.brandWorkspaceTabs, ["No campaign action is available for the current lifecycle state."]],
  [files.featured, ["Escrow Funded", "Settlement Verified"]],
  [files.challengeDetail, ["Arc escrow", "settlement record"]],
  [files.challengeCard, [">Escrow<"]],
  [files.signIn, ["Email callback could not be completed."]],
  [files.authActions, ["OAuth provider is not currently available."]],
  [files.signUpEntry, ["Primary role"]],
  [files.signUp, ["Continue setup for the selected workspace before accessing protected tools."]],
  [files.winnerServer, ["Escrow funding must be verified before final winner selection.", "Finalized payout attempt does not match this funding intent."]],
  [files.aboutArc, ["WinnersPaid events", "campaign completed"]],
]);

for (const [file, terms] of bannedByFile) {
  for (const term of terms) expectNotContains(file, term);
}

if (failures.length) {
  console.error("P0 final approved plain-language copy verifier failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("P0 final approved plain-language copy verifier passed.");
