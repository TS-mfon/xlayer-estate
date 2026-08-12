export type UnderwritingDecision = "approved" | "manual_review" | "rejected";

export interface UnderwritingReport {
  property: {
    address: string;
    type: string;
    areaSqm: number;
    rooms: number;
    owner: string;
    titleStatus: string;
  };
  documentType: string;
  propertyEvidenceScore: number;
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
  mock?: boolean;
  fallbackReason?: string;
}

export interface UnderwritingResponse {
  report: UnderwritingReport;
  evaluationToken?: string;
}
