import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { keccak256, stringToBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getNetwork, type SupportedChainId } from "./network";
import type { GeneratedAssetImage } from "./types";

const EVALUATION_TTL_SECONDS = 30 * 60;
const TYPES = {
  MintAuthorization: [
    { name: "to", type: "address" }, { name: "valuationUsd", type: "uint256" },
    { name: "launchValuationUsd", type: "uint256" }, { name: "riskScore", type: "uint8" },
    { name: "underwritingHash", type: "bytes32" }, { name: "metadataHash", type: "bytes32" },
    { name: "totalShares", type: "uint256" }, { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export interface EvaluationClaims {
  version: 1;
  evaluationId: string;
  reportHash: Hex;
  issuedAt: number;
  expiresAt: number;
  maxImageAttempts: number;
  chainId: SupportedChainId;
}

interface ImageClaims {
  version: 1;
  evaluationId: string;
  reportHash: Hex;
  contentHash: Hex;
  uri: string;
  attempt: number;
  expiresAt: number;
  chainId: SupportedChainId;
}

function requiredSecret(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", requiredSecret("UNDERWRITER_SESSION_SECRET")).update(payload).digest("base64url");
}

function signedToken(value: object) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

function verifiedPayload<T>(token: string): T {
  const [payload, receivedSignature] = token.split(".");
  if (!payload || !receivedSignature) throw new Error("Invalid signed token");
  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("Invalid signed token");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
}

export function issueEvaluationToken(reportHash: Hex, chainId: SupportedChainId = 1952): { token: string; claims: EvaluationClaims } {
  const now = Math.floor(Date.now() / 1000);
  const claims: EvaluationClaims = {
    version: 1,
    evaluationId: randomUUID(),
    reportHash,
    issuedAt: now,
    expiresAt: now + EVALUATION_TTL_SECONDS,
    maxImageAttempts: 2,
    chainId,
  };
  return { token: signedToken(claims), claims };
}

export function verifyEvaluationToken(reportHash: Hex, token: string): EvaluationClaims {
  let claims: EvaluationClaims;
  try { claims = verifiedPayload<EvaluationClaims>(token); }
  catch { throw new Error("Invalid evaluation token"); }
  if (claims.version !== 1 || claims.reportHash.toLowerCase() !== reportHash.toLowerCase()) throw new Error("Evaluation token does not match this report");
  if (claims.expiresAt < Math.floor(Date.now() / 1000)) throw new Error("Evaluation expired. Run underwriting again.");
  return claims;
}

export function assertEvaluationChain(claims: EvaluationClaims, chainId: SupportedChainId) {
  if (claims.chainId !== chainId) throw new Error("Evaluation belongs to a different X Layer network. Run underwriting again.");
}

export function issueImageToken(claims: EvaluationClaims, image: GeneratedAssetImage) {
  return signedToken({
    version: 1,
    evaluationId: claims.evaluationId,
    reportHash: claims.reportHash,
    contentHash: image.contentHash,
    uri: image.uri,
    attempt: image.attempt,
    expiresAt: claims.expiresAt,
    chainId: claims.chainId,
  } satisfies ImageClaims);
}

export function verifyImageToken(reportHash: Hex, image: GeneratedAssetImage, token: string, chainId?: SupportedChainId) {
  let claims: ImageClaims;
  try { claims = verifiedPayload<ImageClaims>(token); }
  catch { throw new Error("Invalid asset image approval"); }
  const matches = claims.version === 1
    && claims.reportHash.toLowerCase() === reportHash.toLowerCase()
    && claims.contentHash.toLowerCase() === image.contentHash.toLowerCase()
    && claims.uri === image.uri
    && claims.attempt === image.attempt
    && (chainId === undefined || claims.chainId === chainId);
  if (!matches) throw new Error("Asset image approval does not match this report and twin");
  if (claims.expiresAt < Math.floor(Date.now() / 1000)) throw new Error("Asset image approval expired. Run underwriting again.");
  return claims;
}

export function imageApprovalMessage(args: { wallet: Address; claims: EvaluationClaims; attempt: number }) {
  return [
    "XLayer Estate asset twin generation",
    `Wallet: ${args.wallet}`,
    `Evaluation: ${args.claims.evaluationId}`,
    `Report: ${args.claims.reportHash}`,
    `Attempt: ${args.attempt}`,
    `Expires: ${args.claims.expiresAt}`,
  ].join("\n");
}

export async function signMintAuthorization(args: {
  chainId: SupportedChainId;
  to: Address; valuationUsd: bigint; launchValuationUsd: bigint; riskScore: number;
  underwritingHash: Hex; metadataHash: Hex; totalShares: bigint; nonce: bigint; deadline: bigint;
}) {
  const account = privateKeyToAccount(requiredSecret("UNDERWRITER_PRIVATE_KEY") as Hex);
  const network = getNetwork(args.chainId);
  const { chainId, ...message } = args;
  const domain = { name: "XLayerEstate", version: "2", chainId, verifyingContract: network.registry } as const;
  const signatureValue = await account.signTypedData({ domain, types: TYPES, primaryType: "MintAuthorization", message });
  return { signature: signatureValue, underwriter: account.address, chainId, verifyingContract: network.registry };
}

export function hashText(value: string): Hex {
  return keccak256(stringToBytes(value));
}
