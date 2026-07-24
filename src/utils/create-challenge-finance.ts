import type {
  PrizeDistribution,
  PrizeDistributionMode,
  PrizePool,
} from "@/types/create-challenge";

const USDC_DECIMALS = 6;
const USDC_BASE = BigInt(1_000_000);
const PLATFORM_FEE_BPS = BigInt(100);
const BPS_BASE = BigInt(10_000);
const PLACES = ["1st", "2nd", "3rd"] as const;

export type PrizeMathResult = {
  prizePoolUnits: string;
  distributionUnits: string[];
  platformFeeUnits: string;
  totalRequiredUnits: string;
  allocatedUnits: string;
  remainingUnits: string;
  errors: string[];
};

export function parseUsdcUnits(value: string | number): {
  units: bigint;
  error?: string;
} {
  const raw = String(value).trim().replace(/,/g, "");
  if (!raw) return { units: BigInt(0), error: "Amount is required." };
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return { units: BigInt(0), error: "Amount must be a valid positive number." };
  }
  const [whole, fraction = ""] = raw.split(".");
  if (fraction.length > USDC_DECIMALS) {
    return { units: BigInt(0), error: "Amount cannot exceed 6 decimal places." };
  }
  const units =
    BigInt(whole) * USDC_BASE +
    BigInt(fraction.padEnd(USDC_DECIMALS, "0"));
  if (units <= BigInt(0)) return { units, error: "Amount must be greater than zero." };
  return { units };
}

export function formatUsdcUnits(units: string | bigint) {
  const value = typeof units === "bigint" ? units : BigInt(units || "0");
  const whole = value / USDC_BASE;
  const fraction = (value % USDC_BASE).toString().padStart(USDC_DECIMALS, "0");
  return `${whole}.${fraction}`.replace(/\.?0+$/, "");
}

function feeUnitsCeil(prizePoolUnits: bigint) {
  return (prizePoolUnits * PLATFORM_FEE_BPS + BPS_BASE - BigInt(1)) / BPS_BASE;
}

function recommendedUnits(total: bigint) {
  const first = (total * BigInt(6000)) / BPS_BASE;
  const second = (total * BigInt(3000)) / BPS_BASE;
  return [first, second, total - first - second];
}

function equalUnits(total: bigint) {
  const base = total / BigInt(3);
  const remainder = total % BigInt(3);
  return [base + remainder, base, base];
}

function customUnits(distribution: PrizeDistribution[]) {
  return PLACES.map((_, index) => {
    const parsed = parseUsdcUnits(distribution[index]?.amount ?? "");
    return parsed.units;
  });
}

export function calculatePrizePool(input: {
  totalAmount: number | string;
  winnerCount: 1 | 3;
  distributionMode: PrizeDistributionMode;
  prizeDistribution: PrizeDistribution[];
}): PrizeMathResult {
  const errors: string[] = [];
  const parsedTotal = parseUsdcUnits(input.totalAmount);
  if (parsedTotal.error) errors.push(parsedTotal.error);
  const prizePoolUnits = parsedTotal.units;

  let distributionUnits: bigint[];
  if (input.winnerCount === 1) {
    distributionUnits = [prizePoolUnits];
  } else if (input.distributionMode === "equal") {
    distributionUnits = equalUnits(prizePoolUnits);
  } else if (input.distributionMode === "custom") {
    distributionUnits = customUnits(input.prizeDistribution);
  } else {
    distributionUnits = recommendedUnits(prizePoolUnits);
  }

  if (distributionUnits.some((item) => item <= BigInt(0))) {
    errors.push("Every prize amount must be greater than zero.");
  }

  const allocatedUnits = distributionUnits.reduce((sum, item) => sum + item, BigInt(0));
  const remainingUnits = prizePoolUnits - allocatedUnits;
  if (remainingUnits !== BigInt(0)) {
    errors.push("Prize distribution must equal the total prize pool.");
  }

  const platformFeeUnits = feeUnitsCeil(prizePoolUnits);
  const totalRequiredUnits = prizePoolUnits + platformFeeUnits;

  return {
    prizePoolUnits: prizePoolUnits.toString(),
    distributionUnits: distributionUnits.map(String),
    platformFeeUnits: platformFeeUnits.toString(),
    totalRequiredUnits: totalRequiredUnits.toString(),
    allocatedUnits: allocatedUnits.toString(),
    remainingUnits: remainingUnits.toString(),
    errors,
  };
}

export function distributionFromUnits(units: string[]): PrizeDistribution[] {
  return units.map((unit, index) => ({
    place: PLACES[index] ?? `${index + 1}th`,
    amount: Number(formatUsdcUnits(unit)),
    currency: "test USDC",
  }));
}

export function normalizePrizePool(pool: PrizePool): PrizePool {
  const distributionMode =
    pool.winnerCount === 1 ? "recommended" : pool.distributionMode ?? "recommended";
  const math = calculatePrizePool({
    totalAmount: pool.totalAmount,
    winnerCount: pool.winnerCount,
    distributionMode,
    prizeDistribution: pool.prizeDistribution,
  });
  const derivedDistribution =
    pool.winnerCount === 1 || distributionMode !== "custom"
      ? distributionFromUnits(math.distributionUnits)
      : pool.prizeDistribution;

  return {
    ...pool,
    distributionMode,
    prizeDistribution: derivedDistribution,
    platformFee: Number(formatUsdcUnits(math.platformFeeUnits)),
    totalRequired: Number(formatUsdcUnits(math.totalRequiredUnits)),
    prizePoolUnits: math.prizePoolUnits,
    distributionUnits: math.distributionUnits,
    platformFeeUnits: math.platformFeeUnits,
    totalRequiredUnits: math.totalRequiredUnits,
    allocatedUnits: math.allocatedUnits,
    remainingUnits: math.remainingUnits,
  };
}

export function hasExactPrizeDistribution(pool: PrizePool) {
  const math = calculatePrizePool({
    totalAmount: pool.totalAmount,
    winnerCount: pool.winnerCount,
    distributionMode: pool.distributionMode,
    prizeDistribution: pool.prizeDistribution,
  });
  return math.errors.length === 0;
}
