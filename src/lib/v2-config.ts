import type { Address } from "viem";

const zero = "0x0000000000000000000000000000000000000000" as Address;
const address = (name: string) => (process.env[name] || zero) as Address;

export const V2_CONFIG = {
  testnet: {
    evidence: address("NEXT_PUBLIC_V2_EVIDENCE_ADDRESS"),
    policy: address("NEXT_PUBLIC_V2_POLICY_ADDRESS"),
    passport: address("NEXT_PUBLIC_V2_PASSPORT_ADDRESS"),
    registry: address("NEXT_PUBLIC_V2_REGISTRY_ADDRESS"),
    market: address("NEXT_PUBLIC_V2_MARKET_ADDRESS"),
    gateway: address("NEXT_PUBLIC_V2_GATEWAY_ADDRESS"),
    deploymentBlock: Number(process.env.NEXT_PUBLIC_V2_DEPLOYMENT_BLOCK || 0),
  },
} as const;

export function v2Configured() {
  return Object.values(V2_CONFIG.testnet).slice(0, 6).every((value) => typeof value === "string" && value !== zero);
}
