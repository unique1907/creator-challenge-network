import type {
  CreateChallengeDraftState,
  CreateChallengeStep,
} from "@/types/create-challenge";

export const createChallengeSteps: CreateChallengeStep[] = [
  {
    id: "basics",
    label: "Basics",
    description: "Demo challenge identity and creative brief.",
  },
  {
    id: "prize-pool",
    label: "Prize Pool",
    description: "Test USDC reward model and winner split.",
  },
  {
    id: "review-rules",
    label: "Review Rules",
    description: "Blind review, anonymity, formats, and usage rights.",
  },
  {
    id: "funding",
    label: "Funding",
    description: "Arc Testnet funding readiness placeholder.",
  },
  {
    id: "deploy",
    label: "Deploy",
    description: "Final review before a future testnet deployment.",
  },
];

export const demoCreateChallengeDraft: CreateChallengeDraftState = {
  challenge: {
    title: "Motion Design Challenge",
    brandName: "Spotify Demo",
    category: "Motion Design",
    market: "Demo / Testnet",
    description:
      "Demo draft for a funded creative competition. No real funds, wallets, or escrow actions are performed in this foundation task.",
    referenceLinks: ["https://example.com/demo-reference"],
    attachments: ["demo-brief-placeholder.pdf"],
    deadline: "2026-08-15",
  },
  prizePool: {
    totalAmount: 50000,
    currency: "test USDC",
    winnerCount: 3,
    prizeDistribution: [
      { place: "1st", amount: 30000, currency: "test USDC" },
      { place: "2nd", amount: 15000, currency: "test USDC" },
      { place: "3rd", amount: 5000, currency: "test USDC" },
    ],
    platformFee: 0,
    estimatedGas: 0,
    totalRequired: 50000,
  },
  reviewRules: {
    blindReview: true,
    anonymousSubmission: true,
    aiAllowed: false,
    allowedFormats: ["MP4", "MOV", "Storyboard PDF"],
    usageRights: "Demo usage-rights summary for testnet validation only.",
  },
  funding: {
    network: "Arc Testnet",
    walletId: "demo-wallet-id",
    walletAddress: "demo-wallet-address",
    availableBalance: 50000,
    fundingStatus: "demo-ready",
    escrowStatus: "demo-only",
    transactionId: "",
    transactionHash: "",
  },
  deployment: {
    status: "draft",
    currentStep: "basics",
    errorMessage: "",
    challengeId: "",
  },
};
