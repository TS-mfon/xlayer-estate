import { keccak256, stringToBytes } from "viem";
import type { UnderwritingReport } from "./types";

export function serializeReport(report: UnderwritingReport): string {
  return JSON.stringify(report);
}

/** Canonical hash of an underwriting report, stored on-chain for tamper-evidence. */
export function hashReport(json: string): `0x${string}` {
  return keccak256(stringToBytes(json));
}
