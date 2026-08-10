export type CcnEscrowAbiEntry = {
  type: string;
  name?: string;
  anonymous?: boolean;
  stateMutability?: string;
  inputs?: Array<{ name?: string; type: string; indexed?: boolean }>;
  outputs?: Array<{ name?: string; type: string }>;
};

export const CCN_ESCROW_ABI = [
  {
    type: "event",
    name: "ChallengeFunded",
    anonymous: false,
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "sponsor", type: "address", indexed: true },
      { name: "prizePool", type: "uint256", indexed: false },
      { name: "platformFee", type: "uint256", indexed: false },
      { name: "winnerCount", type: "uint8", indexed: false },
      { name: "submissionDeadline", type: "uint64", indexed: false },
      { name: "reviewDeadline", type: "uint64", indexed: false },
    ],
  },
  {
    type: "function",
    name: "fundChallenge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "amounts", type: "uint256[]" },
      { name: "platformFee", type: "uint256" },
      { name: "submissionDeadline", type: "uint64" },
      { name: "reviewDeadline", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getChallenge",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [
      { name: "sponsor", type: "address" },
      { name: "prizePool", type: "uint256" },
      { name: "platformFee", type: "uint256" },
      { name: "submissionDeadline", type: "uint64" },
      { name: "reviewDeadline", type: "uint64" },
      { name: "winnerCount", type: "uint8" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "getPrizeDistribution",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getTotalLockedLiabilities",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isFunded",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "totalLockedPlatformFees",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalLockedPrizePools",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "treasury",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const satisfies readonly CcnEscrowAbiEntry[];
