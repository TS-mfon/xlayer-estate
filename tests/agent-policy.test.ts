import assert from "node:assert/strict";
import test from "node:test";
import { validateAgentProposal } from "../src/lib/agent-policy";

const base = { requestId: "request-123456", action: "RESTRICT_PASSPORT", passportId: `0x${"11".repeat(32)}`, reason: "Evidence freshness degraded below policy threshold", evidence: ["passport-stale", "liquidity-thin"], expiresAt: Math.floor(Date.now() / 1000) + 300, actor: `0x${"22".repeat(20)}` };

test("agent policy accepts only bounded risk-reducing proposals", () => {
  assert.equal(validateAgentProposal(base).action, "RESTRICT_PASSPORT");
});

test("agent policy rejects arbitrary trading actions and long-lived expiry", () => {
  assert.throws(() => validateAgentProposal({ ...base, action: "BUY_ASSET" }));
  assert.throws(() => validateAgentProposal({ ...base, expiresAt: Math.floor(Date.now() / 1000) + 3_600 }));
});
