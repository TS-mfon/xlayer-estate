import test from "node:test";
import assert from "node:assert/strict";
import { calculateMarketPricing } from "../src/lib/market-data";

const info = {
  owner: "0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E" as `0x${string}`,
  valuationUsd: 50n,
  launchValuationUsd: 50n,
  totalShares: 1_000_000n,
  riskScore: 70,
  status: 1,
  underwritingHash: `0x${"11".repeat(32)}` as `0x${string}`,
  metadataHash: `0x${"22".repeat(32)}` as `0x${string}`,
  metadataURI: "data:application/json;base64,e30=",
  timestamp: 1n,
};

test("calculates live share price and implied market cap from reserves", () => {
  const pricing = calculateMarketPricing(info, [185_227n, 10_800_000n, 1_414_213n, 1_414_213n, true]);
  assert.equal(pricing.spotPricePerShare, 10.8 / 185_227);
  assert.equal(pricing.impliedMarketCap, pricing.spotPricePerShare * 1_000_000);
  assert.ok((pricing.sinceLaunchChange ?? 0) > 16 && (pricing.sinceLaunchChange ?? 0) < 17);
});

test("reports price movement against a prior snapshot", () => {
  const pricing = calculateMarketPricing(info, [200_000n, 10_000_000n, 1n, 1n, true], 0.00004);
  assert.equal(pricing.change24h, 25);
  assert.equal(pricing.sinceLaunchChange, 0);
});
