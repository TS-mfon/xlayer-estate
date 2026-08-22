import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAssetPolicy } from "../src/lib/evaluation-policy";

test("deterministic policy approves a strong tangible-asset evaluation", () => {
  const result = evaluateAssetPolicy({ tangible: true, evidenceScore: 82, authenticityScore: 76, confidenceScore: 68, riskScore: 24, valuationUsd: 450, fatalFlags: [] });
  assert.equal(result.approved, true);
  assert.equal(result.normalizedRiskScore, 32);
});

test("deterministic policy blocks copied media and weak valuation confidence", () => {
  const result = evaluateAssetPolicy({ tangible: true, evidenceScore: 80, authenticityScore: 72, confidenceScore: 15, riskScore: 10, valuationUsd: 450, fatalFlags: ["Downloaded product image"] });
  assert.equal(result.approved, false);
  assert.equal(result.normalizedRiskScore, 85);
  assert.ok(result.reasons.length >= 2);
});
