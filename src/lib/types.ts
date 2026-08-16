export type UnderwritingDecision = "approved" | "manual_review" | "rejected";

export interface UnderwritingReport {
  asset: {
    name: string;
    category: string;
    brand: string;
    model: string;
    condition: string;
    identifier: string;
    ownershipClaim: string;
  };
  sourceType: string;
  assetEvidenceScore: number;
  authenticityScore: number;
  valuationConfidence: number;
  valuationUsd: number;
  launchValuationUsd: number;
  valuationRange: [number, number];
  riskScore: number;
  riskFlags: string[];
  evidenceFound: string[];
  missingEvidence: string[];
  decision: UnderwritingDecision;
  decisionReasons: string[];
  summary: string;
  mintEligible: boolean;
  ownershipVerified: false;
  mock?: boolean;
  fallbackReason?: string;
}

export interface UnderwritingResponse {
  report: UnderwritingReport;
  evaluationToken?: string;
  evaluationExpiresAt?: number;
}

export interface GeneratedAssetImage {
  uri: string;
  contentHash: `0x${string}`;
  status: "generated" | "fallback_photo" | "fallback_svg";
  model: string;
  promptVersion: string;
  attempt: number;
  originalSourcePublished: boolean;
  storage: "github" | "data";
}

export interface AssetMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  underwriting_report: string;
  underwriting_report_hash: `0x${string}`;
  attributes: Array<{ trait_type: string; value: string | number; display_type?: string }>;
}

export type PortfolioRole = "issuer" | "holder" | "former_holder";
export interface PortfolioAsset {
  tokenId: bigint;
  balance: bigint;
  issuer: `0x${string}`;
  listed: boolean;
  role: PortfolioRole;
  metadataURI: string;
  metadata?: AssetMetadata;
}
