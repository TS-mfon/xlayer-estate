import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { processAssetImage, providerFallbackReason, selectAssetImageSource } from "../src/lib/asset-image";
import type { UnderwritingReport } from "../src/lib/types";

const report = {
  asset: { name: "Studio Laptop", category: "electronics", brand: "Generic", model: "Creator 14", condition: "used-good", identifier: "visible-model", ownershipClaim: "self-attested" },
  sourceType: "image/jpeg",
  assetEvidenceScore: 84,
  authenticityScore: 72,
  valuationConfidence: 74,
  valuationUsd: 640,
  launchValuationUsd: 520,
  valuationRange: [500, 700],
  riskScore: 28,
  riskFlags: [],
  evidenceFound: ["recognizable laptop"],
  missingEvidence: ["receipt"],
  decision: "approved",
  decisionReasons: ["clear tangible asset"],
  summary: "A recognizable used laptop.",
  mintEligible: true,
  ownershipVerified: false,
} satisfies UnderwritingReport;

test("source photo derivatives are bounded WebP images", async () => {
  const source = await sharp({
    create: { width: 1800, height: 900, channels: 3, background: "#c58f54" },
  }).jpeg().toBuffer();

  const output = await processAssetImage(source, false);
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.format, "webp");
  assert.ok((metadata.width ?? 0) <= 560);
  assert.ok((metadata.height ?? 0) <= 420);
  assert.equal(metadata.exif, undefined);
});

test("provider quota failure selects a sanitized source-photo twin", () => {
  const reason = providerFallbackReason(new Error("429 RESOURCE_EXHAUSTED quota limit: 0"));
  const selected = selectAssetImageSource({ report, generated: null, sourcePhoto: Buffer.from("photo"), providerFailure: reason });

  assert.equal(selected.status, "fallback_photo");
  assert.equal(selected.model, "sanitized-source-photo");
  assert.equal(selected.sourcePhotoUsed, true);
  assert.match(selected.fallbackReason ?? "", /quota/i);
  assert.match(selected.fallbackReason ?? "", /sanitized source-photo/i);
});

test("non-image evidence receives a deterministic protocol twin", () => {
  const selected = selectAssetImageSource({ report, generated: null, sourcePhoto: null, providerFailure: "Gemini image generation is temporarily unavailable." });

  assert.equal(selected.status, "fallback_svg");
  assert.equal(selected.model, "protocol-twin-svg");
  assert.equal(selected.sourcePhotoUsed, false);
  assert.match(selected.bytes.toString(), /XLAYER ESTATE \/ PROTOCOL TWIN/);
  assert.match(selected.fallbackReason ?? "", /not a photo/i);
});
