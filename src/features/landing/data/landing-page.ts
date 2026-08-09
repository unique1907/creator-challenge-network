export type TrustIndicator = {
  title: string;
  description: string;
  icon: "wallet" | "arc" | "usdc" | "blind";
};

export type TestnetMetric = {
  value: string;
  label: string;
  detail: string;
  icon: "wallet" | "usdc" | "send" | "arc" | "blind";
  logoSrc?: string;
  logoAlt?: string;
};

export type ProcessStep = {
  label: string;
  description: string;
  icon: "brand" | "lock" | "creators" | "blind" | "payout";
};

export const trustIndicators: TrustIndicator[] = [
  {
    title: "Arc",
    description: "Challenge funding and creator settlement run on Arc Testnet.",
    icon: "arc",
  },
  {
    title: "Circle Wallets",
    description: "Brand and Creator payment wallets are powered by Circle Wallets.",
    icon: "wallet",
  },
  {
    title: "USDC",
    description: "Rewards are funded in advance and settled in test USDC.",
    icon: "usdc",
  },
  {
    title: "Blind Review",
    description: "Brand reviewers evaluate anonymous solution proposals before selection.",
    icon: "blind",
  },
];

export const testnetMetrics: TestnetMetric[] = [
  {
    value: "Arc",
    label: "Challenge funding",
    detail: "Challenge funding and creator settlement run on Arc Testnet.",
    icon: "arc",
    logoSrc: "/brand/partners/arc-logo.png",
    logoAlt: "Arc logo",
  },
  {
    value: "Circle Wallets",
    label: "Payment wallets",
    detail: "Brand and Creator payment wallets are powered by Circle Wallets.",
    icon: "wallet",
    logoSrc: "/brand/partners/circle-logo.png",
    logoAlt: "Circle logo",
  },
  {
    value: "USDC",
    label: "Funded rewards",
    detail: "Rewards are funded in advance and settled in test USDC.",
    icon: "usdc",
  },
  {
    value: "Blind Review",
    label: "Evaluation model",
    detail: "Brand reviewers evaluate anonymous solution proposals before selection.",
    icon: "blind",
  },
];

export const processSteps: ProcessStep[] = [
  {
    label: "Define the Business Problem",
    description: "Turn a real business need into a structured challenge.",
    icon: "brand",
  },
  {
    label: "Fund the Reward in USDC",
    description: "Lock the reward before the challenge goes live.",
    icon: "lock",
  },
  {
    label: "Receive Solution Proposals",
    description: "Creators submit solutions before the deadline.",
    icon: "creators",
  },
  {
    label: "Evaluate and Select",
    description: "Review anonymous proposals and choose the best outcome.",
    icon: "blind",
  },
  {
    label: "Settle the Reward on Arc",
    description: "Release the reward after winner finalization.",
    icon: "payout",
  },
];
