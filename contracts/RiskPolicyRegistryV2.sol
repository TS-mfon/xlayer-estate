// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract RiskPolicyRegistryV2 is Ownable {
    struct Policy {
        uint16 minimumEvidenceScoreBps;
        uint16 minimumAuthenticityScoreBps;
        uint16 minimumConfidenceBps;
        uint8 maximumRiskScore;
        uint16 liquidityHaircutBps;
        uint16 maximumPriceImpactBps;
        bool active;
    }

    error InvalidPolicy();
    error UnknownPolicy(bytes32 policyId);

    mapping(bytes32 => Policy) public policies;

    event PolicySet(bytes32 indexed policyId, Policy policy);
    event PolicyDisabled(bytes32 indexed policyId);

    constructor() Ownable() {}

    function setPolicy(bytes32 policyId, Policy calldata policy) external onlyOwner {
        if (policyId == bytes32(0) || policy.minimumEvidenceScoreBps > 10_000 || policy.minimumAuthenticityScoreBps > 10_000 || policy.minimumConfidenceBps > 10_000 || policy.liquidityHaircutBps > 10_000 || policy.maximumPriceImpactBps > 10_000 || policy.maximumRiskScore > 100) revert InvalidPolicy();
        policies[policyId] = policy;
        emit PolicySet(policyId, policy);
    }

    function disablePolicy(bytes32 policyId) external onlyOwner {
        if (!policies[policyId].active) revert UnknownPolicy(policyId);
        policies[policyId].active = false;
        emit PolicyDisabled(policyId);
    }

    function eligible(bytes32 policyId, uint16 evidenceScoreBps, uint16 authenticityScoreBps, uint16 confidenceBps, uint8 riskScore) external view returns (bool) {
        Policy memory policy = policies[policyId];
        return policy.active && evidenceScoreBps >= policy.minimumEvidenceScoreBps && authenticityScoreBps >= policy.minimumAuthenticityScoreBps && confidenceBps >= policy.minimumConfidenceBps && riskScore <= policy.maximumRiskScore;
    }
}
