import { NextRequest, NextResponse } from "next/server";
import { SchemaType } from "@google/generative-ai";
import { getGenAI } from "@/lib/gemini";
import type { UnderwritingReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    property: {
      type: SchemaType.OBJECT,
      properties: {
        address: { type: SchemaType.STRING },
        type: { type: SchemaType.STRING },
        areaSqm: { type: SchemaType.NUMBER },
        rooms: { type: SchemaType.NUMBER },
        owner: { type: SchemaType.STRING },
        titleStatus: { type: SchemaType.STRING },
      },
      required: ["address", "type", "areaSqm", "rooms", "owner", "titleStatus"],
    },
    valuationUsd: { type: SchemaType.NUMBER },
    valuationRange: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
    riskScore: { type: SchemaType.NUMBER },
    riskFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    summary: { type: SchemaType.STRING },
  },
  required: ["property", "valuationUsd", "valuationRange", "riskScore", "riskFlags", "summary"],
};

const SYSTEM = `You are a real-estate underwriting agent for an RWA tokenization platform on X Layer.
Read the supplied property document (deed, title, valuation report, or listing) and return a structured underwriting report.
Estimate a fair market value in USD, a 0-100 risk score (0 = very safe, 100 = very high risk), and concrete risk flags.
Be conservative and precise. If a field is missing from the document, infer a plausible value and note the assumption in the summary.`;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "File is too large (12 MB maximum)" }, { status: 413 });
    }
    const supported = file.type.startsWith("image/") || file.type === "application/pdf" ||
      ["text/plain", "text/markdown", "text/csv", "application/json"].includes(file.type);
    if (!supported) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }

    const genAI = getGenAI();
    if (!genAI) {
      return NextResponse.json(mockReport(file));
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
      systemInstruction: SYSTEM,
    });

    const parts: any[] = [];
    const mime = file.type;
    if (mime.startsWith("image/") || mime === "application/pdf") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      parts.push({
        inlineData: { mimeType: mime || "application/octet-stream", data: Buffer.from(bytes).toString("base64") },
      });
    } else {
      const text = await file.text();
      parts.push({ text: `Document text:\n${text.slice(0, 30000)}` });
    }
    parts.push({ text: "Return the underwriting report as JSON." });

    try {
      const result = await model.generateContent({ contents: [{ role: "user", parts }] });
      const text = result.response.text();
      const parsed = JSON.parse(text) as UnderwritingReport;
      if (!parsed.property?.address || !Number.isFinite(parsed.valuationUsd) || !Number.isFinite(parsed.riskScore)) {
        throw new Error("Gemini returned an incomplete underwriting report");
      }
      parsed.riskScore = Math.max(0, Math.min(100, Math.round(parsed.riskScore)));
      return NextResponse.json(parsed);
    } catch (providerError) {
      console.error("Gemini unavailable; using deterministic fallback", providerError);
      const fallback = mockReport(file);
      fallback.fallbackReason = "Live Gemini was unavailable; deterministic fallback used.";
      return NextResponse.json(fallback);
    }
  } catch (e: any) {
    console.error("underwrite error", e);
    return NextResponse.json({ error: e?.message ?? "underwrite failed" }, { status: 500 });
  }
}

// ---- Deterministic mock underwriter (no API key required) -------------------
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mockReport(file: File): UnderwritingReport {
  const seed = hashStr(`${file.name}:${file.size}`);
  const r = (n: number) => ((seed >> (n * 5)) & 0xff) / 255;
  const streets = ["Maple Ave", "Ocean Blvd", "King St", "Riverside Dr", "Hillcrest Rd"];
  const cities = ["Lisbon", "Dubai", "Austin", "Berlin", "Singapore"];
  const types = ["Apartment", "Detached House", "Commercial Unit", "Development Land"];
  const titles = ["Freehold", "Leasehold", "Encumbered"];
  const owners = ["A. Rivera", "J. Okafor", "M. Tanaka", "L. Schmidt", "P. Novak"];

  const type = types[Math.floor(r(1) * types.length)];
  const titleStatus = titles[Math.floor(r(2) * titles.length)];
  const valuation = 250_000 + Math.floor((r(3) * 2_250_000) / 10_000) * 10_000;
  const riskScore = 5 + Math.floor(r(4) * 55);
  const area = 60 + Math.floor(r(5) * 440);
  const rooms = 1 + Math.floor(r(6) * 6);

  const riskFlags: string[] = [];
  if (titleStatus === "Encumbered") riskFlags.push("Existing encumbrance on title");
  if (riskScore > 40) riskFlags.push("Verify independent lien search");
  if (type === "Development Land") riskFlags.push("Planning/zoning approval pending");

  return {
    property: {
      address: `${100 + Math.floor(r(7) * 890)} ${streets[Math.floor(r(8) * streets.length)]}, ${
        cities[Math.floor(r(9) * cities.length)]
      }`,
      type,
      areaSqm: area,
      rooms,
      owner: owners[Math.floor(r(10) * owners.length)],
      titleStatus,
    },
    valuationUsd: valuation,
    valuationRange: [Math.floor(valuation * 0.9), Math.floor(valuation * 1.1)],
    riskScore,
    riskFlags,
    summary: `AI agent underwrote this ${type.toLowerCase()} (${area} m², ${rooms} rooms, ${
      titleStatus
    } title). Estimated fair value ${valuation.toLocaleString()} USD. ${
      riskFlags.length ? "Flags: " + riskFlags.join("; ") + "." : "No major risk flags detected."
    } Generated by the local mock underwriter (set GEMINI_API_KEY for live Gemini analysis).`,
    mock: true,
  };
}
