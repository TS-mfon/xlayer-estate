import type { Address, Hex } from "viem";

export const AGENT_ACTIONS = ["RESTRICT_PASSPORT", "RETIRE_PASSPORT"] as const;
export type AgentActionName = typeof AGENT_ACTIONS[number];

export type AgentProposal = {
  requestId: string;
  action: AgentActionName;
  passportId: Hex;
  reason: string;
  evidence: string[];
  expiresAt: number;
  actor: Address;
};

export function validateAgentProposal(value: unknown): AgentProposal {
  if (!value || typeof value !== "object") throw new Error("Agent proposal must be an object");
  const input = value as Record<string, unknown>;
  const action = input.action;
  const passportId = input.passportId;
  const actor = input.actor;
  if (typeof input.requestId !== "string" || input.requestId.length < 8 || input.requestId.length > 128) throw new Error("Invalid agent request ID");
  if (typeof action !== "string" || !AGENT_ACTIONS.includes(action as AgentActionName)) throw new Error("Agent action is not allowed");
  if (typeof passportId !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(passportId)) throw new Error("Invalid Passport identifier");
  if (typeof actor !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(actor)) throw new Error("Invalid agent actor");
  if (typeof input.reason !== "string" || input.reason.length < 12 || input.reason.length > 1_000) throw new Error("Agent reason is invalid");
  if (!Array.isArray(input.evidence) || input.evidence.length > 16 || input.evidence.some((item) => typeof item !== "string" || item.length > 500)) throw new Error("Agent evidence is invalid");
  const expiresAt = Number(input.expiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || expiresAt > Math.floor(Date.now() / 1000) + 900) throw new Error("Agent proposal expiry is invalid");
  return { requestId: input.requestId, action: action as AgentActionName, passportId: passportId as Hex, reason: input.reason, evidence: input.evidence as string[], expiresAt, actor: actor as Address };
}
