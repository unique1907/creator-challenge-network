export const CREATE_CHALLENGE_BALANCE_TTL_MS = 30_000;

export type CcnRevenueFeeType = "PERCENT" | "FIXED" | "HYBRID";
export type CcnRevenueFeePayer = "BRAND";

export type CcnRevenueModelConfig = {
  version: 1;
  feeType: CcnRevenueFeeType;
  feeValue: number;
  feePayer: CcnRevenueFeePayer;
  rounding: "CEIL_TO_USDC_BASE_UNITS";
};

export const CCN_REVENUE_MODEL: CcnRevenueModelConfig = {
  version: 1,
  feeType: "PERCENT",
  feeValue: 10,
  feePayer: "BRAND",
  rounding: "CEIL_TO_USDC_BASE_UNITS",
} as const;

export const REVENUE_PERCENT_BPS_BASE = BigInt(10_000);

export function calculatePlatformFeeUnits(
  prizePoolUnits: bigint,
  config: CcnRevenueModelConfig = CCN_REVENUE_MODEL,
) {
  if (config.feeType !== "PERCENT") {
    throw new Error(`Unsupported revenue fee type: ${config.feeType}`);
  }

  const feeBps = BigInt(Math.round(config.feeValue * 100));
  return (
    prizePoolUnits * feeBps +
    REVENUE_PERCENT_BPS_BASE -
    BigInt(1)
  ) / REVENUE_PERCENT_BPS_BASE;
}
