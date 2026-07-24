export type PlatformStat = {
  label: string;
  value: string;
  detail: string;
};

export type ChallengeTrack = {
  title: string;
  description: string;
  reward: string;
};

export type WorkflowStep = {
  title: string;
  description: string;
};

export type ValidationItem = {
  label: string;
  status: "ready" | "in-progress" | "planned";
};

export type ChallengeStatus = "open" | "reviewing" | "funded";

export type EscrowStatus = "Arc-funded" | "Escrow ready" | "Funding locked";

export type Challenge = {
  slug: string;
  title: string;
  brand: string;
  category: string;
  rewardUsdc: number;
  deadline: string;
  submissions: number;
  status: ChallengeStatus;
  usageRights: string;
  escrowStatus: EscrowStatus;
  summary: string;
  brief: string;
  deliverables: string[];
  evaluation: string[];
  audience: string;
  accent: "blue" | "purple" | "teal";
  winnerModel?: string;
  prizeDistribution?: string[];
  fundingTransactionHash?: string;
  escrowContractAddress?: string;
};
