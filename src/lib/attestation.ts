import { createHmac, timingSafeEqual } from "node:crypto";
import { keccak256, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RWA_ADDRESS } from "./config";

const CHAIN_ID = 1952;
const DOMAIN = { name: "XLayerEstate", version: "2", chainId: CHAIN_ID, verifyingContract: RWA_ADDRESS } as const;
const TYPES = {
  MintAuthorization: [
    { name: "to", type: "address" },
    { name: "valuationUsd", type: "uint256" },
    { name: "launchValuationUsd", type: "uint256" },
    { name: "riskScore", type: "uint8" },
    { name: "underwritingHash", type: "bytes32" },
    { name: "metadataHash", type: "bytes32" },
    { name: "totalShares", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

function requiredSecret(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function evaluationToken(reportHash: Hex) {
  return createHmac("sha256", requiredSecret("UNDERWRITER_SESSION_SECRET")).update(reportHash).digest("hex");
}

export function verifyEvaluationToken(reportHash: Hex, token: string) {
  const expected = Buffer.from(evaluationToken(reportHash), "hex");
  const received = Buffer.from(token, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function signMintAuthorization(args: {
  to: `0x${string}`;
  valuationUsd: bigint;
  launchValuationUsd: bigint;
  riskScore: number;
  underwritingHash: Hex;
  metadataHash: Hex;
  totalShares: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  const account = privateKeyToAccount(requiredSecret("UNDERWRITER_PRIVATE_KEY") as `0x${string}`);
  const signature = await account.signTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: "MintAuthorization",
    message: args,
  });
  return { signature, underwriter: account.address };
}

export function hashText(value: string): Hex {
  return keccak256(stringToBytes(value));
}
