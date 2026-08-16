import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hashText, signMintAuthorization, verifyEvaluationToken, verifyImageToken } from "@/lib/attestation";
import { serializeReport } from "@/lib/metadata";
import { storeJson } from "@/lib/github-storage";
import { RWA_ADDRESS, TOTAL_SHARES } from "@/lib/config";
import type { AssetMetadata, GeneratedAssetImage, UnderwritingReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); }
  catch { return fail("INVALID_REQUEST", "Send report metadata as multipart form data", 400); }
  try {
    const report = JSON.parse(String(form.get("report") ?? "null")) as UnderwritingReport | null;
    const evaluation = String(form.get("evaluationToken") ?? "");
    const recipient = String(form.get("recipient") ?? "") as `0x${string}`;
    const image = JSON.parse(String(form.get("image") ?? "null")) as GeneratedAssetImage | null;
    const imageToken = String(form.get("imageToken") ?? "");
    if (!report || !evaluation || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) return fail("MISSING_INPUT", "Report, evaluation, and wallet recipient are required", 400);
    if (!image?.uri || !image.contentHash || !imageToken) return fail("MISSING_ASSET_IMAGE", "Generate and approve the asset twin before minting", 400);
    const reportJson = serializeReport(report);
    const reportHash = hashText(reportJson);
    verifyEvaluationToken(reportHash, evaluation);
    verifyImageToken(reportHash, image, imageToken);
    if (!report.mintEligible || report.decision !== "approved") return fail("NOT_MINT_ELIGIBLE", "This asset is not approved for minting", 422);
    const reportStorage = await storeJson(`reports/${reportHash.slice(2)}.json`, JSON.parse(reportJson));
    const metadata: AssetMetadata = { name: report.asset.name, description: `${report.summary} Ownership is self-attested and not legally verified by XLayer Estate.`, image: image.uri, underwriting_report: reportStorage.uri, underwriting_report_hash: reportHash, attributes: [{ trait_type: "Launch valuation", value: report.launchValuationUsd, display_type: "number" }, { trait_type: "Risk score", value: report.riskScore, display_type: "number" }, { trait_type: "Asset category", value: report.asset.category }, { trait_type: "Condition", value: report.asset.condition }, { trait_type: "Evidence score", value: report.assetEvidenceScore, display_type: "number" }, { trait_type: "Authenticity score", value: report.authenticityScore, display_type: "number" }, { trait_type: "Image status", value: image.status }, { trait_type: "Source photo used", value: image.sourcePhotoUsed ? "Yes — sanitized derivative" : "No" }, { trait_type: "Ownership", value: "Self-attested / not verified" }] };
    const metadataJson = JSON.stringify(metadata);
    const metadataHash = hashText(metadataJson);
    const metadataStorage = await storeJson(`metadata/${metadataHash.slice(2)}.json`, metadata);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
    const nonce = BigInt(`0x${randomBytes(16).toString("hex")}`);
    const signed = await signMintAuthorization({ to: recipient, valuationUsd: BigInt(Math.round(report.valuationUsd)), launchValuationUsd: BigInt(Math.round(report.launchValuationUsd)), riskScore: report.riskScore, underwritingHash: reportHash, metadataHash, totalShares: TOTAL_SHARES, nonce, deadline });
    return NextResponse.json({ hash: reportHash, metadataHash, uri: metadataStorage.uri, imageUri: image.uri, pinned: metadataStorage.storage === "github", storage: metadataStorage.storage, nonce: nonce.toString(), deadline: deadline.toString(), signature: signed.signature, underwriter: signed.underwriter, contract: RWA_ADDRESS });
  } catch (error) {
    console.error("metadata error", error);
    return fail("METADATA_FAILED", error instanceof Error ? error.message : "Metadata preparation failed", 502, true);
  }
}
function fail(code: string, message: string, status: number, retryable = false) { return NextResponse.json({ error: { code, message, retryable } }, { status }); }
