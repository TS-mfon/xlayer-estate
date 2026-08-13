import { NextRequest, NextResponse } from "next/server";
import { SchemaType } from "@google/generative-ai";
import { getGenAI } from "@/lib/gemini";
import { evaluationToken, hashText } from "@/lib/attestation";
import { serializeReport } from "@/lib/metadata";
import type { UnderwritingReport, UnderwritingResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    sourceType: { type: SchemaType.STRING },
    isTangibleAsset: { type: SchemaType.BOOLEAN },
    assetEvidenceScore: { type: SchemaType.NUMBER },
    authenticityScore: { type: SchemaType.NUMBER },
    evidenceFound: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    missingEvidence: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    fatalFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    reasoning: { type: SchemaType.STRING },
  },
  required: ["sourceType", "isTangibleAsset", "assetEvidenceScore", "authenticityScore", "evidenceFound", "missingEvidence", "fatalFlags", "reasoning"],
};

const REPORT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    asset: { type: SchemaType.OBJECT, properties: {
      name: { type: SchemaType.STRING }, category: { type: SchemaType.STRING }, brand: { type: SchemaType.STRING }, model: { type: SchemaType.STRING }, condition: { type: SchemaType.STRING }, identifier: { type: SchemaType.STRING }, ownershipClaim: { type: SchemaType.STRING },
    }, required: ["name", "category", "brand", "model", "condition", "identifier", "ownershipClaim"] },
    valuationUsd: { type: SchemaType.NUMBER }, valuationRange: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } }, valuationConfidence: { type: SchemaType.NUMBER }, riskScore: { type: SchemaType.NUMBER }, riskFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }, summary: { type: SchemaType.STRING },
  },
  required: ["asset", "valuationUsd", "valuationRange", "valuationConfidence", "riskScore", "riskFlags", "summary"],
};

const GATE_SYSTEM = `You are a strict tangible-asset image and evidence gate. The current date is August 13, 2026. Accept recognizable lawful physical items such as laptops, phones, cameras, watches, furniture, tools, vehicles, collectibles, appliances, cups, equipment, and real estate. Reject people, animals, food intended for immediate consumption, services, ideas, financial instruments, screenshots without a visible asset, blank files, illegal goods, weapons, obviously AI-generated or manipulated evidence, and unrecognizable images. A clear original photo can be sufficient evidence that an item exists, but it never proves legal ownership. Do not require confidential deeds, receipts, serial numbers, identity documents, or addresses. Never claim ownership is verified.`;
const REPORT_SYSTEM = `You are a conservative tangible-asset valuation agent. Analyze only visible or supplied evidence. Identify the item, category, brand/model when visible, condition, and any non-sensitive identifier. Treat ownership as self-attested and unverified. Estimate current second-hand USD value, not original retail price. Use a wide range when uncertain and use the lower range bound as launch valuation. Small ordinary items such as cups are valid if recognizable and worth at least $1. Risk is 0 low to 100 high. Do not invent serial numbers, brands, models, provenance, or ownership.`;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const score = (value: unknown) => { const number = Number(value ?? 0); if (number > 0 && number <= 1) return clamp(number * 100); if (number > 1 && number <= 10) return clamp(number * 10); return clamp(number); };

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("MISSING_FILE", "Upload an asset photo or supporting file", 400);
    if (file.size > 4 * 1024 * 1024) return fail("FILE_TOO_LARGE", "File is too large (4 MB maximum)", 413);
    const supported = file.type.startsWith("image/") || file.type === "application/pdf" || ["text/plain", "text/markdown", "text/csv", "application/json"].includes(file.type);
    if (!supported) return fail("UNSUPPORTED_FILE", "Upload an image, PDF, TXT, Markdown, CSV, or JSON file", 415);
    const text = !file.type.startsWith("image/") && file.type !== "application/pdf" ? (await file.text()).slice(0, 40_000) : "";
    const genAI = getGenAI();
    if (!genAI) return NextResponse.json(offlineResponse(file, text));
    const parts = text ? [{ text }] : [{ inlineData: { data: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType: file.type } }];
    const gateModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json", responseSchema: GATE_SCHEMA }, systemInstruction: GATE_SYSTEM });
    const gateRaw = JSON.parse((await gateModel.generateContent({ contents: [{ role: "user", parts: [...parts, { text: "Screen this upload. Return only gate JSON." }] }] })).response.text());
    const gate = normalizeGate(gateRaw);
    const decision = decide(gate);
    if (decision !== "approved") return NextResponse.json({ report: blockedReport(gate, decision) });
    const reportModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json", responseSchema: REPORT_SCHEMA }, systemInstruction: REPORT_SYSTEM });
    const raw = JSON.parse((await reportModel.generateContent({ contents: [{ role: "user", parts: [...parts, { text: "Produce conservative tangible-asset valuation JSON." }] }] })).response.text());
    const report = normalizeReport(raw, gate);
    if (!report.mintEligible) return NextResponse.json({ report });
    return NextResponse.json({ report, evaluationToken: evaluationToken(hashText(serializeReport(report))) });
  } catch (error) {
    console.error("asset evaluation error", error);
    return fail("EVALUATION_FAILED", error instanceof Error ? error.message : "Asset evaluation failed", 500, true);
  }
}

type Gate = { sourceType: string; isTangibleAsset: boolean; assetEvidenceScore: number; authenticityScore: number; evidenceFound: string[]; missingEvidence: string[]; fatalFlags: string[]; reasoning: string };
function normalizeGate(raw: Record<string, unknown>): Gate { return { sourceType: String(raw.sourceType ?? "Unknown upload"), isTangibleAsset: Boolean(raw.isTangibleAsset), assetEvidenceScore: score(raw.assetEvidenceScore), authenticityScore: score(raw.authenticityScore), evidenceFound: strings(raw.evidenceFound), missingEvidence: strings(raw.missingEvidence), fatalFlags: strings(raw.fatalFlags), reasoning: String(raw.reasoning ?? "") }; }
function decide(gate: Gate) { if (!gate.isTangibleAsset || gate.fatalFlags.length || gate.assetEvidenceScore < 50 || gate.authenticityScore < 45) return "rejected" as const; if (gate.assetEvidenceScore < 65 || gate.authenticityScore < 55) return "manual_review" as const; return "approved" as const; }
function blockedReport(gate: Gate, decision: "manual_review" | "rejected"): UnderwritingReport { return { asset: { name: "Asset not verified", category: gate.sourceType, brand: "Unknown", model: "Unknown", condition: "Unknown", identifier: "Not provided", ownershipClaim: "Self-attested; not verified" }, sourceType: gate.sourceType, assetEvidenceScore: gate.assetEvidenceScore, authenticityScore: gate.authenticityScore, valuationConfidence: 0, valuationUsd: 0, launchValuationUsd: 0, valuationRange: [0, 0], riskScore: 100, riskFlags: gate.fatalFlags, evidenceFound: gate.evidenceFound, missingEvidence: gate.missingEvidence, decision, decisionReasons: [gate.reasoning || "The upload did not meet the asset evidence threshold."], summary: decision === "rejected" ? "This upload was rejected because it does not show a sufficiently recognizable, lawful physical asset." : "This upload needs clearer asset evidence before tokenization.", mintEligible: false, ownershipVerified: false }; }
function normalizeReport(raw: Record<string, any>, gate: Gate): UnderwritingReport {
  const point = Math.max(0, Math.round(Number(raw.valuationUsd ?? 0)));
  const values = Array.isArray(raw.valuationRange) ? raw.valuationRange.map(Number).filter(Number.isFinite) : [];
  const low = Math.max(1, Math.round(Math.min(...(values.length ? values : [point]))));
  const high = Math.max(low, Math.round(Math.max(...(values.length ? values : [point]))));
  const confidence = score(raw.valuationConfidence);
  const asset = raw.asset ?? {};
  const report: UnderwritingReport = { asset: { name: String(asset.name ?? "Physical asset"), category: String(asset.category ?? "Other"), brand: String(asset.brand ?? "Unknown"), model: String(asset.model ?? "Unknown"), condition: String(asset.condition ?? "Unknown"), identifier: String(asset.identifier ?? "Not visible"), ownershipClaim: "Self-attested; not verified" }, sourceType: gate.sourceType, assetEvidenceScore: gate.assetEvidenceScore, authenticityScore: gate.authenticityScore, valuationConfidence: confidence, valuationUsd: point, launchValuationUsd: low, valuationRange: [low, high], riskScore: score(raw.riskScore), riskFlags: strings(raw.riskFlags), evidenceFound: gate.evidenceFound, missingEvidence: gate.missingEvidence, decision: "approved", decisionReasons: [], summary: String(raw.summary ?? "Conservative AI estimate based on the supplied asset evidence."), mintEligible: true, ownershipVerified: false };
  if (!report.asset.name || point < 1 || confidence < 45) { report.decision = "manual_review"; report.mintEligible = false; report.decisionReasons.push("The item or its second-hand value could not be estimated with enough confidence."); }
  return report;
}
function strings(value: unknown) { return Array.isArray(value) ? value.map(String).slice(0, 12) : []; }
function offlineResponse(file: File, text: string): UnderwritingResponse { const report = blockedReport({ sourceType: file.type || "Upload", isTangibleAsset: false, assetEvidenceScore: text ? 35 : 50, authenticityScore: 30, evidenceFound: [], missingEvidence: ["Live visual AI verification"], fatalFlags: [], reasoning: "Gemini is unavailable, so the asset cannot be safely valued or authorized." }, "manual_review"); report.mock = true; report.fallbackReason = "Gemini is unavailable. Mint authorization requires live asset evaluation."; return { report }; }
function fail(code: string, message: string, status: number, retryable = false) { return NextResponse.json({ error: { code, message, retryable } }, { status }); }
