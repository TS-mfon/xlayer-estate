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
}
