// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./EvidenceRegistryV2.sol";
import "./RiskPolicyRegistryV2.sol";

contract AssetPassportRegistryV2 is Ownable {
    enum Status {
        NONE,
        ACTIVE,
        RESTRICTED,
        RETIRED
    }

    struct Passport {
        bytes32 assetId;
        uint64 version;
        bytes32 evidenceRoot;
        uint256 conservativeValueUsd18;
        uint8 riskScore;
        uint16 confidenceBps;
        uint64 validUntil;
        bytes32 policyId;
        Status status;
        uint64 committedAt;
    }

    error NotAdmission();
    error ZeroIdentifier();
    error InvalidValue();
    error InvalidRiskScore();
    error InvalidConfidence();
    error InvalidExpiry();
    error InvalidEvidenceRoot();
    error NonSequentialVersion(uint64 expected, uint64 received);
    error UnknownPassport(bytes32 passportId);
    error EvidenceUnavailable(bytes32 evidenceId);
    error PolicyRejected();

    EvidenceRegistryV2 public immutable evidenceRegistry;
    RiskPolicyRegistryV2 public immutable policyRegistry;
    mapping(address => bool) public admission;
    mapping(bytes32 => uint64) public latestVersion;
    mapping(bytes32 => Passport) public passports;

    event AdmissionSet(address indexed account, bool allowed);
    event PassportCommitted(bytes32 indexed passportId, bytes32 indexed assetId, uint64 indexed version, bytes32 evidenceRoot, bytes32 policyId);
    event PassportStatusSet(bytes32 indexed passportId, Status status);

    modifier onlyAdmission() {
        if (!admission[msg.sender] && msg.sender != owner()) revert NotAdmission();
        _;
    }

    constructor(EvidenceRegistryV2 evidenceRegistry_, RiskPolicyRegistryV2 policyRegistry_) Ownable() {
        if (address(evidenceRegistry_) == address(0) || address(policyRegistry_) == address(0)) revert ZeroIdentifier();
        evidenceRegistry = evidenceRegistry_;
        policyRegistry = policyRegistry_;
        admission[msg.sender] = true;
        emit AdmissionSet(msg.sender, true);
    }

    function setAdmission(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroIdentifier();
        admission[account] = allowed;
        emit AdmissionSet(account, allowed);
    }

    function setStatusOperator(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroIdentifier();
        admission[account] = allowed;
        emit AdmissionSet(account, allowed);
    }

    function passportIdFor(bytes32 assetId, uint64 version) public pure returns (bytes32) {
        return keccak256(abi.encode(assetId, version));
    }

    function evidenceRootFor(bytes32[] calldata evidenceIds) public pure returns (bytes32) {
        if (evidenceIds.length == 0) return bytes32(0);
        return keccak256(abi.encodePacked(evidenceIds));
    }

    function commitPassport(
        bytes32 assetId,
        bytes32[] calldata evidenceIds,
        uint64 version,
        uint256 conservativeValueUsd18,
        uint8 riskScore,
        uint16 confidenceBps,
        uint64 validUntil,
        bytes32 policyId
    ) external onlyAdmission returns (bytes32 passportId) {
        if (assetId == bytes32(0) || policyId == bytes32(0)) revert ZeroIdentifier();
        if (evidenceIds.length == 0 || evidenceRootFor(evidenceIds) == bytes32(0)) revert InvalidEvidenceRoot();
        if (conservativeValueUsd18 == 0) revert InvalidValue();
        if (riskScore > 100) revert InvalidRiskScore();
        if (confidenceBps > 10_000) revert InvalidConfidence();
        if (validUntil <= block.timestamp) revert InvalidExpiry();
        uint64 expectedVersion = latestVersion[assetId] + 1;
        if (version != expectedVersion) revert NonSequentialVersion(expectedVersion, version);
        for (uint256 index; index < evidenceIds.length; ++index) {
            if (!evidenceRegistry.exists(evidenceIds[index])) revert EvidenceUnavailable(evidenceIds[index]);
        }
        if (!policyRegistry.eligible(policyId, _minEvidenceScore(evidenceIds), _minAuthenticityScore(evidenceIds), confidenceBps, riskScore)) revert PolicyRejected();
        passportId = passportIdFor(assetId, version);
        passports[passportId] = Passport({
            assetId: assetId,
            version: version,
            evidenceRoot: evidenceRootFor(evidenceIds),
            conservativeValueUsd18: conservativeValueUsd18,
            riskScore: riskScore,
            confidenceBps: confidenceBps,
            validUntil: validUntil,
            policyId: policyId,
            status: Status.ACTIVE,
            committedAt: uint64(block.timestamp)
        });
        latestVersion[assetId] = version;
        emit PassportCommitted(passportId, assetId, version, passports[passportId].evidenceRoot, policyId);
    }

    function setPassportStatus(bytes32 passportId, Status status) external onlyAdmission {
        Passport storage passport = passports[passportId];
        if (passport.committedAt == 0) revert UnknownPassport(passportId);
        if (status == Status.NONE) revert InvalidRiskScore();
        passport.status = status;
        emit PassportStatusSet(passportId, status);
    }

    function isMintEligible(bytes32 passportId) external view returns (bool) {
        Passport memory passport = passports[passportId];
        return passport.committedAt != 0 && passport.status == Status.ACTIVE && passport.validUntil >= block.timestamp;
    }

    function _minEvidenceScore(bytes32[] calldata evidenceIds) internal view returns (uint16 score) {
        score = type(uint16).max;
        for (uint256 index; index < evidenceIds.length; ++index) {
            (uint16 current,, bool active) = evidenceRegistry.scores(evidenceIds[index]);
            if (!active) revert EvidenceUnavailable(evidenceIds[index]);
            if (current < score) score = current;
        }
    }

    function _minAuthenticityScore(bytes32[] calldata evidenceIds) internal view returns (uint16 score) {
        score = type(uint16).max;
        for (uint256 index; index < evidenceIds.length; ++index) {
            (, uint16 current, bool active) = evidenceRegistry.scores(evidenceIds[index]);
            if (!active) revert EvidenceUnavailable(evidenceIds[index]);
            if (current < score) score = current;
        }
    }
}
