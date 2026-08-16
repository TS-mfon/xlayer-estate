import assert from "node:assert/strict";
import test from "node:test";
import { issueEvaluationToken, issueImageToken, verifyEvaluationToken, verifyImageToken } from "../src/lib/attestation";
import { hashReport, serializeReport } from "../src/lib/metadata";
import type { UnderwritingReport } from "../src/lib/types";

process.env.UNDERWRITER_SESSION_SECRET = "xlayer-estate-test-secret";

const report: UnderwritingReport = {
  asset: {
    name: "MacBook Pro",
    category: "electronics",
    brand: "Apple",
    model: "MacBook Pro",
    condition: "used-good",
    identifier: "visible-model-only",
    ownershipClaim: "self-attested",
  },
  sourceType: "image/jpeg",
  assetEvidenceScore: 88,
  authenticityScore: 79,
  valuationConfidence: 76,
  valuationUsd: 900,
  launchValuationUsd: 720,
  valuationRange: [720, 980],
  riskScore: 24,
  riskFlags: [],
  evidenceFound: ["recognizable physical laptop"],
  missingEvidence: ["purchase receipt"],
  decision: "approved",
  decisionReasons: ["clear tangible asset evidence"],
  summary: "A visibly used Apple laptop with conservative resale value.",
  mintEligible: true,
  ownershipVerified: false,
};

test("evaluation tokens verify only for the canonical report hash", () => {
  const reportHash = hashReport(serializeReport(report));
  const { token, claims } = issueEvaluationToken(reportHash);

  assert.equal(verifyEvaluationToken(reportHash, token).evaluationId, claims.evaluationId);
  assert.throws(
    () => verifyEvaluationToken(hashReport("different-report"), token),
    /does not match this report/,
  );
});

test("evaluation tokens reject tampering and expiry", () => {
  const originalNow = Date.now;
  const reportHash = hashReport(serializeReport(report));
  const { token } = issueEvaluationToken(reportHash);

  assert.throws(() => verifyEvaluationToken(reportHash, `${token.slice(0, -1)}x`), /Invalid evaluation token/);

  Date.now = () => originalNow() + 31 * 60 * 1000;
  try {
    assert.throws(() => verifyEvaluationToken(reportHash, token), /Evaluation expired/);
  } finally {
    Date.now = originalNow;
  }
});

test("canonical report serialization excludes transient fallback details", () => {
  const withFallback = { ...report, fallbackReason: "provider timeout" };

  assert.equal(serializeReport(withFallback), serializeReport(report));
  assert.equal(hashReport(serializeReport(withFallback)), hashReport(serializeReport(report)));
});

test("asset image approvals bind the selected twin to its report", () => {
  const reportHash = hashReport(serializeReport(report));
  const { claims } = issueEvaluationToken(reportHash);
  const image = {
    uri: "https://raw.githubusercontent.com/example/media/commit/assets/twin.webp",
    contentHash: hashReport("image-bytes"),
    status: "generated" as const,
    model: "gemini-image",
    promptVersion: "asset-twin-v1",
    attempt: 1,
    originalSourcePublished: false,
    sourcePhotoUsed: false,
    storage: "github" as const,
  };
  const token = issueImageToken(claims, image);

  assert.equal(verifyImageToken(reportHash, image, token).contentHash, image.contentHash);
  assert.throws(
    () => verifyImageToken(reportHash, { ...image, uri: `${image.uri}?changed=1` }, token),
    /does not match this report and twin/,
  );
});
