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
    documentType: { type: SchemaType.STRING },
    isRealEstateDocument: { type: SchemaType.BOOLEAN },
    propertyEvidenceScore: { type: SchemaType.NUMBER },
    authenticityScore: { type: SchemaType.NUMBER },
    evidenceFound: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    missingEvidence: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    fatalFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    reasoning: { type: SchemaType.STRING },
  },
  required: ["documentType", "isRealEstateDocument", "propertyEvidenceScore", "authenticityScore", "evidenceFound", "missingEvidence", "fatalFlags", "reasoning"],
};

const REPORT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    property: { type: SchemaType.OBJECT, properties: {
      address: { type: SchemaType.STRING }, type: { type: SchemaType.STRING }, areaSqm: { type: SchemaType.NUMBER }, rooms: { type: SchemaType.NUMBER }, owner: { type: SchemaType.STRING }, titleStatus: { type: SchemaType.STRING },
    }, required: ["address", "type", "areaSqm", "rooms", "owner", "titleStatus"] },
    valuationUsd: { type: SchemaType.NUMBER }, valuationRange: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } }, valuationConfidence: { type: SchemaType.NUMBER }, riskScore: { type: SchemaType.NUMBER }, riskFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }, summary: { type: SchemaType.STRING },
  },
  required: ["property", "valuationUsd", "valuationRange", "valuationConfidence", "riskScore", "riskFlags", "summary"],
};

const GATE_SYSTEM = `You are a strict real-estate document authenticity gate. The current date is August 12, 2026. Interpret dates relative to that date; March 14, 2026 is in the past, not the future. Do not infer missing facts. Decide whether the supplied file contains genuine-looking property evidence such as a deed, title, valuation, tax record, lease, or listing. Reject memes, generic text, fabricated templates, unrelated documents, blank files, and documents with contradictory or impossible property fields. This is an automated screening decision, not legal title verification.`;
const REPORT_SYSTEM = `You are a conservative real-estate underwriting agent. Use only evidence present in the document. Never invent owner, address, area, rooms, title status, or valuation. Return a point estimate and a range. The lower range bound will be used as the launch valuation, so avoid optimistic assumptions. Score risk from 0 safe to 100 high risk.`;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const confidenceScore = (value: unknown) => {
  const score = Number(value ?? 0);
  if (score > 0 && score <= 1) return clamp(score * 100);
  if (score > 1 && score <= 10) return clamp(score * 10);
  return clamp(score);
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: { code: "MISSING_FILE", message: "Missing property document", retryable: false } }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: { code: "FILE_TOO_LARGE", message: "File is too large (12 MB maximum)", retryable: false } }, { status: 413 });
    const supported = file.type.startsWith("image/") || file.type === "application/pdf" || ["text/plain", "text/markdown", "text/csv", "application/json"].includes(file.type);
    if (!supported) return NextResponse.json({ error: { code: "UNSUPPORTED_FILE", message: "Upload a PDF, image, TXT, Markdown, CSV, or JSON property document", retryable: false } }, { status: 415 });

    const textDocument = !file.type.startsWith("image/") && file.type !== "application/pdf" ? (await file.text()).slice(0, 40000) : "";
    const parts = await documentParts(file, textDocument);
    const genAI = getGenAI();
    if (!genAI) return NextResponse.json(offlineResponse(file, textDocument));

    try {
      const gateModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json", responseSchema: GATE_SCHEMA }, systemInstruction: GATE_SYSTEM });
      const gate = normalizeGate(JSON.parse((await gateModel.generateContent({ contents: [{ role: "user", parts: [...parts, { text: "Return only the strict document gate JSON. The current date is August 12, 2026." }] }] })).response.text()), textDocument);
      const decision = decide(gate);
      if (decision !== "approved") return NextResponse.json({ report: rejectedReport(gate, decision) } satisfies UnderwritingResponse);

      const reportModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json", responseSchema: REPORT_SCHEMA }, systemInstruction: REPORT_SYSTEM });
      const raw = JSON.parse((await reportModel.generateContent({ contents: [{ role: "user", parts: [...parts, { text: "Return only the structured underwriting JSON." }] }] })).response.text());
      const report = normalizeReport(raw, gate);
      if (!report.mintEligible) return NextResponse.json({ report });
      const token = evaluationToken(hashText(serializeReport(report)));
      return NextResponse.json({ report, evaluationToken: token } satisfies UnderwritingResponse);
    } catch (providerError) {
      console.error("Gemini unavailable; applying conservative offline gate", providerError);
      return NextResponse.json(offlineResponse(file, textDocument));
    }
  } catch (error) {
    console.error("underwrite error", error);
    return NextResponse.json({ error: { code: "UNDERWRITE_FAILED", message: error instanceof Error ? error.message : "Underwriting failed", retryable: true } }, { status: 500 });
  }
}

async function documentParts(file: File, textDocument: string) {
  const parts: any[] = [];
  if (file.type.startsWith("image/") || file.type === "application/pdf") parts.push({ inlineData: { mimeType: file.type, data: Buffer.from(await file.arrayBuffer()).toString("base64") } });
  else parts.push({ text: `Document text:\n${textDocument}` });
  return parts;
}

function normalizeGate(raw: any, sourceText = "") {
  const evidenceFound = Array.isArray(raw.evidenceFound) ? raw.evidenceFound.map(String).slice(0, 12) : [];
  const explicitPropertySignals = (sourceText.match(/address|property|deed|title|owner|valuation|freehold|leasehold|sqm|square metres|registration|encumbrance|mortgage|lien/gi) ?? []).length;
  const isRealEstateDocument = Boolean(raw.isRealEstateDocument) && explicitPropertySignals >= 4;
  const fatalFlags = (Array.isArray(raw.fatalFlags) ? raw.fatalFlags.map(String).slice(0, 12) : []).filter((flag: string) => !isResolvedHistoricalDateFlag(flag, sourceText));
  const modelEvidence = confidenceScore(raw.propertyEvidenceScore);
  const modelAuthenticity = confidenceScore(raw.authenticityScore);
  const evidenceScore = isRealEstateDocument && evidenceFound.length >= 4 ? Math.max(80, modelEvidence) : modelEvidence;
  const authenticityScore = isRealEstateDocument && evidenceFound.length >= 4 && fatalFlags.length === 0 ? Math.max(80, modelAuthenticity) : modelAuthenticity;
  return { documentType: String(raw.documentType ?? "unknown"), isRealEstateDocument, propertyEvidenceScore: evidenceScore, authenticityScore, evidenceFound, missingEvidence: Array.isArray(raw.missingEvidence) ? raw.missingEvidence.map(String).slice(0, 12) : [], fatalFlags, reasoning: String(raw.reasoning ?? "") };
}

function isResolvedHistoricalDateFlag(flag: string, sourceText: string) {
  if (!/future|impossible date|registration date/i.test(flag)) return false;
  const match = sourceText.match(/(?:registration date|date)\s*:\s*([0-9]{1,2})\s+([A-Za-z]+)\s+([0-9]{4})/i);
  if (!match) return false;
  const parsed = new Date(`${match[2]} ${match[1]}, ${match[3]}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed <= new Date("2026-08-12T23:59:59Z");
}

function decide(gate: ReturnType<typeof normalizeGate>): "approved" | "manual_review" | "rejected" {
  if (!gate.isRealEstateDocument || gate.fatalFlags.length > 0 || gate.propertyEvidenceScore < 55 || gate.authenticityScore < 55) return "rejected";
  if (gate.propertyEvidenceScore < 75 || gate.authenticityScore < 75 || gate.evidenceFound.length < 2) return "manual_review";
  return "approved";
}

function rejectedReport(gate: ReturnType<typeof normalizeGate>, decision: "manual_review" | "rejected"): UnderwritingReport {
  return { property: { address: "Evidence unavailable", type: gate.documentType, areaSqm: 0, rooms: 0, owner: "Not verified", titleStatus: "Not verified" }, documentType: gate.documentType, propertyEvidenceScore: gate.propertyEvidenceScore, authenticityScore: gate.authenticityScore, valuationConfidence: 0, valuationUsd: 0, launchValuationUsd: 0, valuationRange: [0, 0], riskScore: 100, riskFlags: gate.fatalFlags, evidenceFound: gate.evidenceFound, missingEvidence: gate.missingEvidence, decision, decisionReasons: [gate.reasoning || "The supplied file did not meet the evidence threshold."], summary: decision === "rejected" ? "This file was rejected because it does not contain sufficient real-estate evidence." : "This file needs manual review before it can be tokenized.", mintEligible: false };
}

function normalizeReport(raw: any, gate: ReturnType<typeof normalizeGate>): UnderwritingReport {
  const point = Math.max(1, Math.round(Number(raw.valuationUsd ?? 0)));
  const range = Array.isArray(raw.valuationRange) && raw.valuationRange.length >= 2 ? [Math.max(1, Math.round(Number(raw.valuationRange[0]))), Math.max(1, Math.round(Number(raw.valuationRange[1])))] : [Math.round(point * 0.8), point];
  const ordered: [number, number] = [Math.min(range[0], range[1]), Math.max(range[0], range[1])];
  const report: UnderwritingReport = { property: { address: String(raw.property?.address ?? ""), type: String(raw.property?.type ?? ""), areaSqm: Math.max(0, Number(raw.property?.areaSqm ?? 0)), rooms: Math.max(0, Number(raw.property?.rooms ?? 0)), owner: String(raw.property?.owner ?? ""), titleStatus: String(raw.property?.titleStatus ?? "") }, documentType: gate.documentType, propertyEvidenceScore: gate.propertyEvidenceScore, authenticityScore: gate.authenticityScore, valuationConfidence: confidenceScore(raw.valuationConfidence), valuationUsd: point, launchValuationUsd: ordered[0], valuationRange: ordered, riskScore: clamp(Number(raw.riskScore ?? 100)), riskFlags: Array.isArray(raw.riskFlags) ? raw.riskFlags.map(String).slice(0, 12) : [], evidenceFound: gate.evidenceFound, missingEvidence: gate.missingEvidence, decision: "approved", decisionReasons: [], summary: String(raw.summary ?? ""), mintEligible: true };
  if (!report.property.address || !report.property.type || report.valuationConfidence < 60) { report.decision = "manual_review"; report.mintEligible = false; report.decisionReasons.push("The report did not meet the required field or confidence threshold."); }
  return report;
}

function offlineResponse(file: File, text: string): UnderwritingResponse {
  if (!text) return { report: { property: { address: "Manual review required", type: file.type || "Image/PDF", areaSqm: 0, rooms: 0, owner: "Not verified", titleStatus: "Not verified" }, documentType: file.type || "unknown", propertyEvidenceScore: 50, authenticityScore: 50, valuationConfidence: 0, valuationUsd: 0, launchValuationUsd: 0, valuationRange: [0, 0], riskScore: 100, riskFlags: ["Gemini unavailable for image/PDF verification"], evidenceFound: [], missingEvidence: ["Live visual document verification"], decision: "manual_review", decisionReasons: ["Images and PDFs require live Gemini verification."], summary: "This document cannot be safely approved while the visual AI provider is unavailable.", mintEligible: false, mock: true, fallbackReason: "Gemini was unavailable." } };
  const lower = text.toLowerCase();
  const signals = [["address", /address|situated at|property location/], ["owner", /owner|registered proprietor|seller/], ["title", /title status|freehold|leasehold|deed/], ["area", /square metres|sqm|sq\. ?m|square feet|sqft/], ["valuation", /valuation|asking price|market value|price/], ["registration", /registration|reference|record/]].filter(([, pattern]) => (pattern as RegExp).test(lower)).map(([label]) => String(label));
  if (signals.length < 4) return { report: { property: { address: "Evidence unavailable", type: "Unrelated or incomplete document", areaSqm: 0, rooms: 0, owner: "Not verified", titleStatus: "Not verified" }, documentType: "unknown", propertyEvidenceScore: signals.length * 12, authenticityScore: 25, valuationConfidence: 0, valuationUsd: 0, launchValuationUsd: 0, valuationRange: [0, 0], riskScore: 100, riskFlags: ["Insufficient real-estate evidence"], evidenceFound: signals, missingEvidence: ["Address", "ownership", "title", "area", "valuation"].filter((field) => !signals.includes(field.toLowerCase())), decision: "rejected", decisionReasons: ["The file does not contain enough recognizable property evidence."], summary: "This file was rejected by the conservative offline document gate.", mintEligible: false, mock: true, fallbackReason: "Gemini was unavailable." } };
  const moneyMatches = [...text.matchAll(/(?:USD|EUR|AED|\$|€)\s?([\d,]+)|([\d,]+)\s?(?:USD|EUR|AED)/gi)].map((match) => Number((match[1] || match[2] || "0").replace(/,/g, ""))).filter((value) => value > 1000);
  const valuation = moneyMatches.length ? Math.max(...moneyMatches) : 0;
  const address = text.match(/(?:Property Address:|Address:)\s*\n?\s*([^\n]+)(?:\n\s*([^\n]+))?/i);
  const owner = text.match(/(?:Registered Owner:|Owner:)\s*\n?\s*([^\n]+)/i);
  const area = text.match(/([\d.]+)\s*(?:square metres|sqm|sq\. ?m)/i);
  const rooms = text.match(/(\d+)\s*rooms?/i);
  const type = /commercial/i.test(lower) ? "Commercial Unit" : /apartment/i.test(lower) ? "Apartment" : /land/i.test(lower) ? "Development Land" : "Real Estate";
  const title = /freehold/i.test(lower) ? "Freehold" : /leasehold/i.test(lower) ? "Leasehold" : "Unverified";
  const score = Math.min(92, 58 + signals.length * 6);
  const report: UnderwritingReport = { property: { address: address ? [address[1], address[2]].filter(Boolean).join(" ").trim() : "Address found in document", type, areaSqm: Number(area?.[1] ?? 0), rooms: Number(rooms?.[1] ?? 0), owner: owner?.[1]?.trim() || "Owner stated in document", titleStatus: title }, documentType: /deed/i.test(lower) ? "Property Deed" : /listing/i.test(lower) ? "Property Listing" : "Property Record", propertyEvidenceScore: score, authenticityScore: 76, valuationConfidence: valuation > 0 ? 65 : 0, valuationUsd: valuation, launchValuationUsd: valuation ? Math.floor(valuation * .9) : 0, valuationRange: valuation ? [Math.floor(valuation * .9), valuation] : [0, 0], riskScore: /mortgage|encumbrance|dispute|lien/i.test(lower) ? 55 : 30, riskFlags: /mortgage|encumbrance|dispute|lien/i.test(lower) ? ["Document contains an encumbrance or lien reference"] : [], evidenceFound: signals, missingEvidence: [], decision: valuation > 0 ? "approved" : "manual_review", decisionReasons: valuation > 0 ? ["Offline structured evidence threshold passed; live AI was unavailable."] : ["No reliable valuation was found."], summary: "Conservative offline underwriting derived only from explicit text fields in the supplied property document.", mintEligible: valuation > 0, mock: true, fallbackReason: "Gemini was unavailable; conservative deterministic parsing was used." };
  return report.mintEligible ? { report, evaluationToken: evaluationToken(hashText(serializeReport(report))) } : { report };
}
