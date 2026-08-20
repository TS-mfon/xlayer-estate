import { NextRequest, NextResponse } from "next/server";
import { generateStructuredJson, getGenAI } from "@/lib/gemini";
import { issueEvaluationToken, hashText } from "@/lib/attestation";
import { isSupportedChainId, type SupportedChainId } from "@/lib/network";
import { serializeReport } from "@/lib/metadata";
import type { UnderwritingReport, UnderwritingResponse, UnderwritingRejectionCode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    sourceType: { type: "string" }, isTangibleAsset: { type: "boolean" },
    assetEvidenceScore: { type: "number", minimum: 0, maximum: 100 },
    authenticityScore: { type: "number", minimum: 0, maximum: 100 },
    evidenceFound: { type: "array", items: { type: "string" } },
    missingEvidence: { type: "array", items: { type: "string" } },
    fatalFlags: { type: "array", items: { type: "string" } }, reasoning: { type: "string" },
  },
  required: ["sourceType", "isTangibleAsset", "assetEvidenceScore", "authenticityScore", "evidenceFound", "missingEvidence", "fatalFlags", "reasoning"],
};

const REPORT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    asset: { type: "object", additionalProperties: false, properties: {
      name: { type: "string" }, category: { type: "string" }, brand: { type: "string" },
      model: { type: "string" }, condition: { type: "string" }, identifier: { type: "string" }, ownershipClaim: { type: "string" },
    }, required: ["name", "category", "brand", "model", "condition", "identifier", "ownershipClaim"] },
    valuationUsd: { type: "number", minimum: 0 },
    valuationRange: { type: "array", items: { type: "number", minimum: 0 }, minItems: 2, maxItems: 2 },
    valuationConfidence: { type: "number", minimum: 0, maximum: 100 },
    riskScore: { type: "number", minimum: 0, maximum: 100 },
    riskFlags: { type: "array", items: { type: "string" } }, summary: { type: "string" },
  },
  required: ["asset", "valuationUsd", "valuationRange", "valuationConfidence", "riskScore", "riskFlags", "summary"],
};

const GATE_SYSTEM = `You are XLayer Estate's tangible-asset evidence gate. Accept a recognizable lawful physical object: electronics, cups, cameras, watches, furniture, tools, vehicles, collectibles, appliances, equipment, and real estate. Minting requires an original camera photo as the primary evidence. Supporting documents can add context but cannot replace the photo. A clear original photo is enough to show that an item appears to exist, but never proves ownership. Reject people, animals, services, ideas, securities, blank uploads, screenshots, product-page images, catalog/stock photos, downloaded images, visible watermarks, obvious synthetic/manipulated evidence, weapons, illegal goods, explicit material, and unrecognizable files. Missing EXIF is neutral. Do not demand deeds, IDs, addresses, receipts, or serial numbers. Score evidence and authenticity conservatively and explain the strongest missing evidence.`;
const REPORT_SYSTEM = `You are a conservative second-hand tangible-asset valuation agent. Use only visible or supplied evidence. Identify category, visible brand/model, condition, and only non-sensitive identifiers. Ownership is always self-attested and unverified. Estimate current resale value in USD, not retail replacement cost. Use a wide range when uncertain and do not inflate valuation. The launch valuation must be the conservative lower bound. Risk is 0 low to 100 high. Never invent brand, model, serial number, provenance, ownership, dimensions, or condition.`;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const score = (value: unknown) => { const number = Number(value ?? 0); if (number > 0 && number <= 1) return clamp(number * 100); if (number > 1 && number <= 10) return clamp(number * 10); return clamp(number); };
const strings = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 12) : [];

type Gate = { sourceType: string; isTangibleAsset: boolean; assetEvidenceScore: number; authenticityScore: number; evidenceFound: string[]; missingEvidence: string[]; fatalFlags: string[]; reasoning: string };

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); }
  catch { return fail("INVALID_REQUEST", "Send the asset upload as multipart form data", 400); }
  try {
    const file = form.get("file");
    const requestedChainId = Number(form.get("chainId") ?? "1952");
    if (!isSupportedChainId(requestedChainId)) return fail("UNSUPPORTED_CHAIN", "Select X Layer testnet or mainnet", 400);
    if (!(file instanceof File)) return fail("MISSING_FILE", "Upload an original asset photo", 400);
    if (!file.size) return fail("EMPTY_FILE", "The uploaded file is empty", 400);
    if (file.size > 4 * 1024 * 1024) return fail("FILE_TOO_LARGE", "File is too large (4 MB maximum)", 413);
    const supported = file.type.startsWith("image/") || file.type === "application/pdf" || ["text/plain", "text/markdown", "text/csv", "application/json"].includes(file.type);
    if (!supported) return fail("UNSUPPORTED_FILE", "Upload an image, PDF, TXT, Markdown, CSV, or JSON file", 415);
    if (!file.type.startsWith("image/")) return NextResponse.json({ report: blockedReport({ sourceType: file.type || "supporting document", isTangibleAsset: false, assetEvidenceScore: 0, authenticityScore: 0, evidenceFound: [file.name], missingEvidence: ["One original photo of the physical asset"], fatalFlags: [], reasoning: "A supporting document cannot replace the required original asset photo." }, "rejected", "PHOTO_REQUIRED") } satisfies UnderwritingResponse);
    const text = !file.type.startsWith("image/") && file.type !== "application/pdf" ? (await file.text()).slice(0, 40_000) : "";
    if (!getGenAI()) return NextResponse.json(offlineResponse(file, text));
    const parts = text ? [{ text }] : [{ inlineData: { data: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType: file.type } }];
    const gate = normalizeGate(await generateStructuredJson<Record<string, unknown>>({ systemInstruction: GATE_SYSTEM, prompt: "Screen this upload and return only the required evidence gate JSON.", parts, schema: GATE_SCHEMA }));
    const decision = decide(gate);
    if (decision !== "approved") return NextResponse.json({ report: blockedReport(gate, decision) } satisfies UnderwritingResponse);
    const raw = await generateStructuredJson<Record<string, unknown>>({ systemInstruction: REPORT_SYSTEM, prompt: "Produce the required conservative tangible-asset valuation JSON.", parts, schema: REPORT_SCHEMA });
    const report = normalizeReport(raw, gate);
    if (!report.mintEligible) return NextResponse.json({ report } satisfies UnderwritingResponse);
    const issued = issueEvaluationToken(hashText(serializeReport(report)), requestedChainId as SupportedChainId);
    return NextResponse.json({ report, evaluationToken: issued.token, evaluationExpiresAt: issued.claims.expiresAt } satisfies UnderwritingResponse);
  } catch (error) {
    console.error("asset evaluation error", error);
    return fail("EVALUATION_FAILED", "The AI evaluator could not complete this upload. Retry once or use a clearer photo.", 502, true);
  }
}

function normalizeGate(raw: Record<string, unknown>): Gate {
  return { sourceType: String(raw.sourceType ?? "Unknown upload"), isTangibleAsset: Boolean(raw.isTangibleAsset), assetEvidenceScore: score(raw.assetEvidenceScore), authenticityScore: score(raw.authenticityScore), evidenceFound: strings(raw.evidenceFound), missingEvidence: strings(raw.missingEvidence), fatalFlags: strings(raw.fatalFlags), reasoning: String(raw.reasoning ?? "") };
}
function decide(gate: Gate) {
  if (!gate.isTangibleAsset || gate.fatalFlags.length || gate.assetEvidenceScore < 45 || gate.authenticityScore < 40) return "rejected" as const;
  if (gate.assetEvidenceScore < 60 || gate.authenticityScore < 50) return "manual_review" as const;
  return "approved" as const;
}
function blockedReport(gate: Gate, decision: "manual_review" | "rejected", forcedCode?: UnderwritingRejectionCode): UnderwritingReport {
  const copied = gate.fatalFlags.some((flag) => /stock|catalog|download|screenshot|synthetic|manipulat|watermark/i.test(flag));
  const code = forcedCode ?? (copied ? "COPIED_OR_SYNTHETIC" : !gate.isTangibleAsset ? "UNSUPPORTED_ASSET" : decision === "manual_review" ? "MANUAL_REVIEW" : "UNCLEAR_ASSET");
  const suggestions = code === "COPIED_OR_SYNTHETIC"
    ? ["Take a fresh photo of the item around you.", "Include a second angle or a handwritten challenge code beside it.", "Do not upload a product-page, catalog, stock, or downloaded image."]
    : ["Photograph a laptop, phone, monitor, camera, watch, chair, appliance, bicycle, tool, collectible, vehicle, or property near you.", "Show the entire item in one clear, well-lit frame.", "Keep people, unrelated objects, and screen captures out of the photo."];
  return { asset: { name: "Asset evidence unavailable", category: gate.sourceType, brand: "Unknown", model: "Unknown", condition: "Unknown", identifier: "Not provided", ownershipClaim: "Self-attested; not verified" }, sourceType: gate.sourceType, assetEvidenceScore: gate.assetEvidenceScore, authenticityScore: gate.authenticityScore, valuationConfidence: 0, valuationUsd: 0, launchValuationUsd: 0, valuationRange: [0, 0], riskScore: 100, riskFlags: gate.fatalFlags.length ? gate.fatalFlags : ["Insufficient trustworthy asset evidence"], evidenceFound: gate.evidenceFound, missingEvidence: gate.missingEvidence, decision, decisionReasons: [gate.reasoning || "The upload did not meet the evidence threshold."], summary: decision === "rejected" ? "This upload cannot be minted yet because the protocol could not establish a recognizable original physical asset photo." : "This upload needs a clearer original photo before tokenization.", mintEligible: false, ownershipVerified: false, rejection: { code, message: decision === "manual_review" ? "A clearer original photo is needed before this asset can be minted." : "This upload was not accepted as trustworthy physical-asset evidence.", suggestions, retryable: true, requiresFreshPhoto: true } };
}
function normalizeReport(raw: Record<string, unknown>, gate: Gate): UnderwritingReport {
  const asset = (raw.asset ?? {}) as Record<string, unknown>;
  const values = Array.isArray(raw.valuationRange) ? raw.valuationRange.map(Number).filter(Number.isFinite) : [];
  const point = Math.max(1, Math.round(Number(raw.valuationUsd ?? 1)));
  const low = Math.max(1, Math.round(Math.min(...(values.length ? values : [point * 0.55]))));
  const high = Math.max(low, Math.round(Math.max(...(values.length ? values : [point * 1.25]))));
  const confidence = score(raw.valuationConfidence);
  const risk = clamp(Math.max(Number(raw.riskScore ?? 50), 100 - confidence, 100 - gate.authenticityScore));
  const mintEligible = point > 0 && confidence >= 30 && risk <= 88;
  return { asset: { name: String(asset.name ?? "Physical asset"), category: String(asset.category ?? gate.sourceType), brand: String(asset.brand ?? "Unknown"), model: String(asset.model ?? "Unknown"), condition: String(asset.condition ?? "Not fully established"), identifier: String(asset.identifier ?? "Not provided"), ownershipClaim: "Self-attested; not verified" }, sourceType: gate.sourceType, assetEvidenceScore: gate.assetEvidenceScore, authenticityScore: gate.authenticityScore, valuationConfidence: confidence, valuationUsd: point, launchValuationUsd: Math.min(point, low), valuationRange: [low, high], riskScore: risk, riskFlags: strings(raw.riskFlags), evidenceFound: gate.evidenceFound, missingEvidence: gate.missingEvidence, decision: mintEligible ? "approved" : "manual_review", decisionReasons: mintEligible ? ["Recognizable physical asset with sufficient evidence for experimental tokenization."] : ["Valuation confidence or risk did not meet the mint threshold."], summary: String(raw.summary ?? "Conservative second-hand valuation based on supplied evidence."), mintEligible, ownershipVerified: false };
}
function offlineResponse(file: File, text: string): UnderwritingResponse {
  const isImage = file.type.startsWith("image/");
  const report: UnderwritingReport = { asset: { name: file.name.replace(/\.[^.]+$/, "") || "Uploaded physical asset", category: isImage ? "Physical asset photo" : "Asset record", brand: "Unknown", model: "Unknown", condition: "Needs live AI inspection", identifier: "Not provided", ownershipClaim: "Self-attested; not verified" }, sourceType: file.type || "upload", assetEvidenceScore: isImage ? 58 : text.length > 80 ? 45 : 20, authenticityScore: isImage ? 50 : 35, valuationConfidence: 0, valuationUsd: 0, launchValuationUsd: 0, valuationRange: [0, 0], riskScore: 100, riskFlags: ["Live AI evaluator unavailable"], evidenceFound: [file.name], missingEvidence: ["Live visual identification", "Conservative market valuation"], decision: "manual_review", decisionReasons: ["Gemini is not configured, so the protocol will not invent a valuation."], summary: "The upload was received, but live AI underwriting is required before mint authorization.", mintEligible: false, ownershipVerified: false, mock: true, fallbackReason: "Set GEMINI_API_KEY to enable secure mint authorization.", rejection: { code: "MANUAL_REVIEW", message: "Live AI underwriting is required before this asset can be minted.", suggestions: ["Set GEMINI_API_KEY for live evaluation.", "Use one clear original photo of the physical asset."], retryable: true, requiresFreshPhoto: isImage } };
  return { report };
}
function fail(code: string, message: string, status: number, retryable = false) { return NextResponse.json({ error: { code, message, retryable } }, { status }); }
