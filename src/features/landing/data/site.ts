import type {
  ChallengeTrack,
  PlatformStat,
  ValidationItem,
  WorkflowStep,
} from "@/types/ccn";

export const platformStats: PlatformStat[] = [
  {
    label: "Challenge cycles",
    value: "4",
    detail: "Weekly sprints designed for creator proof-of-work.",
  },
  {
    label: "Settlement network",
    value: "Arc",
    detail: "Testnet-first wallet validation using Circle Wallets.",
  },
  {
    label: "Reward currency",
    value: "USDC",
    detail: "Stable test payments before production rails.",
  },
];

export const challengeTracks: ChallengeTrack[] = [
  {
    title: "Create",
    description:
      "Creators publish verifiable challenge outputs, attach proof, and earn a visible reputation trail.",
    reward: "Submission rewards",
  },
  {
    title: "Review",
    description:
      "Curators and sponsors score work against transparent criteria before rewards are released.",
    reward: "Reviewer incentives",
  },
  {
    title: "Settle",
    description:
      "Approved challenge rewards are prepared for wallet-native USDC settlement on Arc.",
    reward: "Programmable payouts",
  },
];

export const workflowSteps: WorkflowStep[] = [
  {
    title: "Challenge brief",
    description:
      "Sponsors define the goal, eligibility rules, payout budget, and acceptance criteria.",
  },
  {
    title: "Creator submission",
    description:
      "Participants submit deliverables with links, notes, wallet identity, and review metadata.",
  },
  {
    title: "Validation panel",
    description:
      "Reviewers triage submissions, resolve disputes, and prepare a final payout roster.",
  },
  {
    title: "Wallet settlement",
    description:
      "Circle-controlled wallets execute testnet payouts before production release hardening.",
  },
];

export const validationItems: ValidationItem[] = [
  { label: "Circle Wallets bootstrap", status: "ready" },
  { label: "Arc Testnet USDC transfer", status: "ready" },
  { label: "Creator challenge workspace", status: "in-progress" },
  { label: "Sponsor admin console", status: "planned" },
];
