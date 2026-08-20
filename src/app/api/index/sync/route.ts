import { NextRequest, NextResponse } from "next/server";
import { syncIndex } from "@/lib/indexer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.INDEXER_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.INDEXER_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await syncIndex()), syncedAt: new Date().toISOString() }); }
  catch (error) { console.error("index sync failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Index sync failed" }, { status: 502 }); }
}
