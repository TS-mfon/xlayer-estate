import assert from "node:assert/strict";
import test from "node:test";
import { listingLaunchState, sharesForSeed } from "../src/lib/marketplace-state";

test("USDC approval remains available before the wallet has the full launch balance", () => {
  const state = listingLaunchState({
    shareApproved: true,
    allowance: 0n,
    usdcBalance: 10_000_000n,
    shareBalance: 1_000_000n,
    seedUsdc: 10_000_000n,
    platformFeeUsdc: 200_000n,
    launchValuationUsd: 50n,
    totalShares: 1_000_000n,
  });

  assert.equal(state.step, 2);
  assert.equal(state.requiredAllowance, 10_200_000n);
  assert.equal(state.canApproveUsdc, true);
  assert.equal(state.hasFunds, false);
  assert.equal(state.canCreatePool, false);
});

test("pool creation unlocks only after allowance, funds, and shares are sufficient", () => {
  const state = listingLaunchState({
    shareApproved: true,
    allowance: 10_200_000n,
    usdcBalance: 35_000_000n,
    shareBalance: 1_000_000n,
    seedUsdc: 10_000_000n,
    platformFeeUsdc: 200_000n,
    launchValuationUsd: 50n,
    totalShares: 1_000_000n,
  });

  assert.equal(state.step, 3);
  assert.equal(state.requiredShares, 200_000n);
  assert.equal(state.canCreatePool, true);
});

test("seed share requirements are valuation anchored and capped at total supply", () => {
  assert.equal(sharesForSeed(10_000_000n, 500_000n, 1_000_000n), 20n);
  assert.equal(sharesForSeed(10_000_000n, 4n, 1_000_000n), 1_000_000n);
  assert.equal(sharesForSeed(10_000_000n, 0n, 1_000_000n), 0n);
});
