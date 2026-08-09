import { keccak256, stringToBytes } from "viem";

/** Canonical hash of an underwriting report, stored on-chain for tamper-evidence. */
export function hashReport(json: string): `0x${string}` {
  return keccak256(stringToBytes(json));
}
