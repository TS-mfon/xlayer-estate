import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { hashReport } from "@/lib/metadata";
import type { UnderwritingReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stores the underwriting report and returns a tamper-proof hash (keccak256)
 * plus a URI that gets written on-chain. The hash lets anyone verify the
 * report matches what was tokenized. Reports are served from /metadata in dev.
 */
export async function POST(req: NextRequest) {
  try {
    const { report } = (await req.json()) as { report: UnderwritingReport };
    if (!report) return NextResponse.json({ error: "Missing report" }, { status: 400 });

    const json = JSON.stringify(report, null, 2);
    const hash = hashReport(json);

    const dir = path.join(process.cwd(), "public", "metadata");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${hash}.json`), json, "utf8");

    const origin = new URL(req.url).origin;
    const uri = `${origin}/metadata/${hash}.json`;

    return NextResponse.json({ hash, uri });
  } catch (e: any) {
    console.error("metadata error", e);
    return NextResponse.json({ error: e?.message ?? "metadata failed" }, { status: 500 });
  }
}
