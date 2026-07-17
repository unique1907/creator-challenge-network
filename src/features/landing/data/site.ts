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
      "Creators submit completed campaign work against a funded brand brief before the deadline.",
    reward: "Completed work",
  },
  {
    title: "Review",
    description:
      "The brand reviews submissions blindly and selects a single winner against public criteria.",
    reward: "Blind review",
  },
  {
    title: "Settle",
    description:
      "The winning creator receives the Arc-secured USDC reward and transfers the predefined usage rights.",
    reward: "Winner payout",
  },
];

export const workflowSteps: WorkflowStep[] = [
  {
    title: "Challenge brief",
    description:
      "Brands define the creative goal, reward, submission deadline, and exact usage-rights terms.",
  },
  {
    title: "Creator submission",
    description:
      "Creators submit finished work, supporting notes, and required deliverables before review.",
  },
  {
    title: "Validation panel",
    description:
      "The brand reviews submissions blindly and selects one winning entry.",
  },
  {
    title: "Wallet settlement",
    description:
      "The predefined USDC reward moves to the winner after usage-rights transfer conditions are satisfied.",
  },
];

export const validationItems: ValidationItem[] = [
  { label: "Circle Wallets bootstrap", status: "ready" },
  { label: "Arc Testnet USDC transfer", status: "ready" },
  { label: "Public challenge experience", status: "in-progress" },
  { label: "Blind review workflow", status: "planned" },
];
