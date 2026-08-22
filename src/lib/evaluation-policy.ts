export const EVALUATION_POLICY_VERSION = "asset-passport-v2.1";

export type EvaluationPolicyInput = {
  tangible: boolean;
  evidenceScore: number;
  authenticityScore: number;
  confidenceScore: number;
  riskScore: number;
  valuationUsd: number;
  fatalFlags: string[];
};

export type EvaluationPolicyResult = {
  approved: boolean;
  normalizedRiskScore: number;
  checks: Array<{ id: string; passed: boolean; message: string }>;
  reasons: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));

export function evaluateAssetPolicy(input: EvaluationPolicyInput): EvaluationPolicyResult {
  const evidenceScore = clamp(input.evidenceScore);
  const authenticityScore = clamp(input.authenticityScore);
  const confidenceScore = clamp(input.confidenceScore);
  const modelRisk = clamp(input.riskScore);
  const normalizedRiskScore = clamp(Math.max(modelRisk, 100 - authenticityScore, 100 - confidenceScore));
  const checks = [
    { id: "tangible", passed: input.tangible, message: "A recognizable physical asset must be present." },
    { id: "evidence", passed: evidenceScore >= 45, message: "Evidence quality must be at least 45/100." },
    { id: "authenticity", passed: authenticityScore >= 45, message: "Authenticity confidence must be at least 45/100." },
    { id: "valuation", passed: confidenceScore >= 30 && input.valuationUsd > 0, message: "The valuation must be positive with at least 30/100 confidence." },
    { id: "risk", passed: normalizedRiskScore <= 88, message: "Normalized risk must not exceed 88/100." },
    { id: "fatal-flags", passed: input.fatalFlags.length === 0, message: "No copied, synthetic, prohibited, or unrecognizable evidence signals may remain." },
  ];
  const reasons = checks.filter((check) => !check.passed).map((check) => check.message);
  return { approved: reasons.length === 0, normalizedRiskScore, checks, reasons };
}
