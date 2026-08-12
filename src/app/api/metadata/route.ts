import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hashReport, serializeReport } from "@/lib/metadata";
import { hashText, signMintAuthorization, verifyEvaluationToken } from "@/lib/attestation";
import { RWA_ADDRESS } from "@/lib/config";
import type { UnderwritingReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const report = JSON.parse(String(form.get("report") ?? "null")) as UnderwritingReport;
    const evaluation = String(form.get("evaluationToken") ?? "");
    const recipient = String(form.get("recipient") ?? "") as `0x${string}`;
    if (!report?.mintEligible || report.decision !== "approved") return fail("REPORT_NOT_MINTABLE", "Only approved reports can be minted", 422);
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) return fail("INVALID_RECIPIENT", "Connect a valid wallet before minting", 400);
    const reportJson = serializeReport(report);
    const reportHash = hashReport(reportJson);
    if (!evaluation || !verifyEvaluationToken(reportHash, evaluation)) return fail("INVALID_EVALUATION", "The underwriting proof is invalid or expired", 403);

    const reportUri = await pinOrData("application/json", reportJson, `xlayer-estate-report-${reportHash}.json`);
    const imageFile = form.get("image");
    const image = imageFile instanceof File && imageFile.size > 0 ? await imageData(imageFile) : generatedImage(report);
    const metadata = { name: `${report.property.type} · XLayer Estate`, description: report.summary, image: image.uri, external_url: `${new URL(req.url).origin}/marketplace`, report_uri: reportUri, report_hash: reportHash, attributes: [{ trait_type: "Launch valuation", value: report.launchValuationUsd, display_type: "number" }, { trait_type: "Risk score", value: report.riskScore, display_type: "number" }, { trait_type: "Property type", value: report.property.type }, { trait_type: "Title status", value: report.property.titleStatus }, { trait_type: "Evidence score", value: report.propertyEvidenceScore, display_type: "number" }, { trait_type: "Authenticity score", value: report.authenticityScore, display_type: "number" }] };
    const metadataJson = JSON.stringify(metadata);
    const metadataHash = hashText(metadataJson);
    const uri = await pinOrData("application/json", metadataJson, `xlayer-estate-${metadataHash}.json`);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
    const nonce = BigInt(`0x${randomBytes(16).toString("hex")}`);
    const signed = await signMintAuthorization({ to: recipient, valuationUsd: BigInt(Math.round(report.valuationUsd)), launchValuationUsd: BigInt(Math.round(report.launchValuationUsd)), riskScore: report.riskScore, underwritingHash: reportHash, metadataHash, totalShares: 1_000_000n, nonce, deadline });
    return NextResponse.json({ hash: reportHash, metadataHash, uri, imageUri: image.uri, pinned: uri.startsWith("ipfs://"), nonce: nonce.toString(), deadline: deadline.toString(), signature: signed.signature, underwriter: signed.underwriter, contract: RWA_ADDRESS });
  } catch (error) {
    console.error("metadata error", error);
    return fail("METADATA_FAILED", error instanceof Error ? error.message : "Metadata preparation failed", 500);
  }
}

async function imageData(file: File) {
  if (file.size > 3 * 1024 * 1024) throw new Error("Property image must be smaller than 3 MB");
  if (!file.type.startsWith("image/")) throw new Error("Property image must be an image file");
  if (process.env.PINATA_JWT) return { uri: await pinFile(file, `xlayer-estate-photo-${Date.now()}`) };
  return { uri: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` };
}

function generatedImage(report: UnderwritingReport) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#08111f"/><stop offset="1" stop-color="#173c51"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="1020" cy="100" r="180" fill="#44dff0" opacity=".13"/><text x="72" y="110" fill="#76ecff" font-family="Arial" font-size="22" letter-spacing="8">XLAYER ESTATE / VERIFIED RWA</text><text x="72" y="250" fill="white" font-family="Arial" font-size="62" font-weight="700">${escapeXml(report.property.type)}</text><text x="72" y="315" fill="#a9c8d5" font-family="Arial" font-size="26">${escapeXml(report.property.address)}</text><text x="72" y="470" fill="#76ecff" font-family="Arial" font-size="34">$${report.launchValuationUsd.toLocaleString()} launch valuation</text><text x="72" y="530" fill="#b9d2dc" font-family="Arial" font-size="22">Risk ${report.riskScore}/100 · X Layer Testnet</text><text x="1050" y="560" fill="#76ecff" font-family="Arial" font-size="52">✦</text></svg>`;
  return { uri: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` };
}

async function pinFile(file: File, name: string) {
  const body = new FormData(); body.append("file", file, name);
  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` }, body });
  if (!response.ok) throw new Error(`Image pinning failed (${response.status})`);
  const data = await response.json() as { IpfsHash?: string };
  if (!data.IpfsHash) throw new Error("Pinata returned no image CID");
  return `ipfs://${data.IpfsHash}`;
}

async function pinOrData(mime: string, content: string, name: string) {
  if (process.env.PINATA_JWT) {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", { method: "POST", headers: { Authorization: `Bearer ${process.env.PINATA_JWT}`, "Content-Type": "application/json" }, body: JSON.stringify({ pinataContent: JSON.parse(content), pinataMetadata: { name } }) });
    if (!response.ok) throw new Error(`Metadata pinning failed (${response.status})`);
    const data = await response.json() as { IpfsHash?: string };
    if (!data.IpfsHash) throw new Error("Pinata returned no metadata CID");
    return `ipfs://${data.IpfsHash}`;
  }
  return `data:${mime};base64,${Buffer.from(content).toString("base64")}`;
}

function escapeXml(value: string) { return value.replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char] ?? char)); }
function fail(code: string, message: string, status: number) { return NextResponse.json({ error: { code, message, retryable: status >= 500 } }, { status }); }
