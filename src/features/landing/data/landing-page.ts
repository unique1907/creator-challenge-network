export type TrustIndicator = {
  title: string;
  description: string;
  icon: "wallet" | "arc" | "usdc" | "blind";
};

export type TestnetMetric = {
  value: string;
  label: string;
  detail: string;
  icon: "wallet" | "usdc" | "send" | "arc";
};

export type ProcessStep = {
  label: string;
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
    title: "Circle Wallets",
    description: "Programmable escrow",
    icon: "wallet",
  },
  {
    title: "Arc Network",
    description: "Built for speed and scalability",
    icon: "arc",
  },
  {
    title: "USDC Escrow",
    description: "Funds locked before review",
    icon: "usdc",
  },
  {
    title: "Blind Review",
    description: "Fair evaluation for every entry",
    icon: "blind",
  },
];

export const testnetMetrics: TestnetMetric[] = [
  {
    value: "1,248",
    label: "Wallets Created",
    detail: "(Testnet)",
    icon: "wallet",
  },
  {
    value: "2.45M",
    label: "Test USDC Secured",
    detail: "in Escrow",
    icon: "usdc",
  },
  {
    value: "8,760",
    label: "Successful Transfers",
    detail: "on Arc Testnet",
    icon: "send",
  },
  {
    value: "Arc Testnet",
    label: "Live and open",
    detail: "for developers",
    icon: "arc",
  },
];

export const processSteps: ProcessStep[] = [
  { label: "Brand creates challenge", icon: "brand" },
  { label: "Prize pool locked in USDC", icon: "lock" },
  { label: "Creators submit anonymously", icon: "creators" },
  { label: "Blind review by the brand", icon: "blind" },
  { label: "Winners paid automatically", icon: "payout" },
];

export const landingChallenges: LandingChallenge[] = [
  {
    brand: "Nike",
    title: "Next Gen Campaign",
    category: "Graphic Design",
    reward: "25,000 USDC",
    winners: "Top 3 rewarded",
    timeLeft: "5d 10h left",
    submissions: 128,
    accent: "nike",
  },
  {
    brand: "Spotify",
    title: "Soundtrack Visuals",
    category: "Motion Design",
    reward: "50,000 USDC",
    winners: "Top 3 rewarded",
    timeLeft: "6d 12h left",
    submissions: 42,
    accent: "spotify",
  },
  {
    brand: "Samsung",
    title: "Future Tech Stories",
    category: "3D / Animation",
    reward: "30,000 USDC",
    winners: "Top 3 rewarded",
    timeLeft: "7d 5h left",
    submissions: 73,
    accent: "samsung",
  },
  {
    brand: "Adobe",
    title: "Creativity For All",
    category: "Illustration",
    reward: "40,000 USDC",
    winners: "Top 5 rewarded",
    timeLeft: "8d 8h left",
    submissions: 156,
    accent: "adobe",
  },
  {
    brand: "Red Bull",
    title: "Energy in Motion",
    category: "Video / Film",
    reward: "35,000 USDC",
    winners: "Top 3 rewarded",
    timeLeft: "4d 18h left",
    submissions: 91,
    accent: "redbull",
  },
  {
    brand: "GoPro",
    title: "Capture The Impossible",
    category: "Video / Film",
    reward: "20,000 USDC",
    winners: "Top 3 rewarded",
    timeLeft: "3d 9h left",
    submissions: 67,
    accent: "gopro",
  },
];
