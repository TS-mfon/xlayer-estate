export const MIN_SEED_USDC = 10_000_000n;

export function sharesForSeed(seedUsdc: bigint, launchValuationUsd: bigint, totalShares: bigint) {
  if (seedUsdc <= 0n || launchValuationUsd <= 0n || totalShares <= 0n) return 0n;
  const shares = seedUsdc * totalShares / (launchValuationUsd * 1_000_000n);
  return shares > totalShares ? totalShares : shares;
}

export function listingLaunchState(args: {
  shareApproved: boolean;
  allowance: bigint;
  usdcBalance: bigint;
  shareBalance: bigint;
  seedUsdc: bigint;
  platformFeeUsdc: bigint;
  launchValuationUsd: bigint;
  totalShares: bigint;
}) {
  const requiredAllowance = args.seedUsdc + args.platformFeeUsdc;
  const requiredShares = sharesForSeed(args.seedUsdc, args.launchValuationUsd, args.totalShares);
  const validSeed = args.seedUsdc >= MIN_SEED_USDC;
  const hasFunds = args.usdcBalance >= requiredAllowance;
  const hasShares = requiredShares > 0n && args.shareBalance >= requiredShares;
  const step = !args.shareApproved ? 1 : args.allowance < requiredAllowance ? 2 : 3;

  return {
    step,
    requiredAllowance,
    requiredShares,
    validSeed,
    hasFunds,
    hasShares,
    canApproveUsdc: args.shareApproved && validSeed,
    canCreatePool: args.shareApproved && args.allowance >= requiredAllowance && validSeed && hasFunds && hasShares,
  };
}
