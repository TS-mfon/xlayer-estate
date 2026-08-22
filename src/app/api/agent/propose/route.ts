import { NextRequest, NextResponse } from "next/server";
import { validateAgentProposal } from "@/lib/agent-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const proposal = validateAgentProposal(await request.json());
    return NextResponse.json({
      proposal,
      execution: "not-authorized",
      message: "Proposal accepted for review. The agent cannot sign or move funds through this endpoint.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: { code: "INVALID_AGENT_PROPOSAL", message: error instanceof Error ? error.message : "Invalid agent proposal", retryable: false } }, { status: 400 });
  }
}
