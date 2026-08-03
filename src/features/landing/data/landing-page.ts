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
};

export type ProcessStep = {
  label: string;
  description: string;
  icon: "brand" | "lock" | "creators" | "blind" | "payout";
};

export type LandingChallenge = {
  brand: string;
  title: string;
  category: string;
  reward: string;
  winners: string;
  timeLeft: string;
  submissions: number;
  accent: "nike" | "spotify" | "samsung" | "adobe" | "redbull" | "gopro";
};

export const trustIndicators: TrustIndicator[] = [
  {
    title: "Circle Hosted Wallets",
    description: "Creator and Brand approvals stay user-controlled.",
    icon: "wallet",
  },
  {
    title: "Arc Testnet",
    description: "Programmable settlement is verified on-chain.",
    icon: "arc",
  },
  {
    title: "USDC Escrow",
    description: "Prize funding is secured before publishing.",
    icon: "usdc",
  },
  {
    title: "Blind Review",
    description: "Brands evaluate entries without Creator identity.",
    icon: "blind",
  },
];

export const testnetMetrics: TestnetMetric[] = [
  {
    value: "Arc",
    label: "Settlement layer",
    detail: "Testnet chain 5042002",
    icon: "arc",
  },
  {
    value: "Circle",
    label: "Wallet approvals",
    detail: "Hosted user-controlled flows",
    icon: "wallet",
  },
  {
    value: "USDC",
    label: "Reward currency",
    detail: "Escrow before publish",
    icon: "usdc",
  },
  {
    value: "Blind",
    label: "Review model",
    detail: "Identity hidden until outcome",
    icon: "blind",
  },
];

export const processSteps: ProcessStep[] = [
  {
    label: "Brand creates challenge",
    description: "Define the brief, reward, dates, rules, and review criteria.",
    icon: "brand",
  },
  {
    label: "Prize pool is funded",
    description: "USDC approval and escrow funding complete before the challenge goes live.",
    icon: "lock",
  },
  {
    label: "Creators submit work",
    description: "Eligible Creators enter through the canonical workspace and submit before deadline.",
    icon: "creators",
  },
  {
    label: "Brand reviews blindly",
    description: "Anonymous entries are scored against the published criteria.",
    icon: "blind",
  },
  {
    label: "Winner receives payout",
    description: "Settlement is reconciled against Arc receipt and WinnersPaid evidence.",
    icon: "payout",
  },
];

export const landingChallenges: LandingChallenge[] = [
  {
    brand: "Nike",
    title: "Motion Campaign",
    category: "Motion Design",
    reward: "3,000 USDC",
    winners: "Top 1 rewarded",
    timeLeft: "Open for submissions",
    submissions: 1,
    accent: "nike",
  },
  {
    brand: "Spotify",
    title: "Soundtrack Visuals",
    category: "Campaign Design",
    reward: "2,500 USDC",
    winners: "Top 1 rewarded",
    timeLeft: "Review-ready format",
    submissions: 8,
    accent: "spotify",
  },
  {
    brand: "Adobe",
    title: "Creativity For All",
    category: "Illustration",
    reward: "4,000 USDC",
    winners: "Top 1 rewarded",
    timeLeft: "Funded challenge",
    submissions: 12,
    accent: "adobe",
  },
];
