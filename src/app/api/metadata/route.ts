import { NextRequest, NextResponse } from "next/server";
import { hashReport, serializeReport } from "@/lib/metadata";
import type { UnderwritingReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { report } = (await req.json()) as { report?: UnderwritingReport };
    if (!report?.property?.address || !Number.isFinite(report.valuationUsd)) {
      return NextResponse.json({ error: "Invalid underwriting report" }, { status: 400 });
    }

    const json = serializeReport(report);
    const hash = hashReport(json);
    const pinataJwt = process.env.PINATA_JWT;

    if (pinataJwt) {
      const pin = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${pinataJwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pinataContent: report, pinataMetadata: { name: `xlayer-estate-${hash}.json` } }),
      });
      if (!pin.ok) throw new Error(`IPFS pinning failed (${pin.status})`);
      const data = (await pin.json()) as { IpfsHash?: string };
      if (!data.IpfsHash) throw new Error("Pinata returned no CID");
      return NextResponse.json({ hash, uri: `ipfs://${data.IpfsHash}`, pinned: true });
    }

    const encoded = Buffer.from(json, "utf8").toString("base64");
    return NextResponse.json({ hash, uri: `data:application/json;base64,${encoded}`, pinned: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "metadata failed";
    console.error("metadata error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
