// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract EvidenceRegistryV2 is Ownable {
    enum EvidenceType {
        PHOTO_ORIGINAL,
        DOCUMENT_SUPPORTING,
        RECEIPT_OR_INVOICE,
        SERIAL_OR_MODEL_PROOF,
        EXTERNAL_ATTESTATION,
        MARKET_COMPARABLE,
        ISSUER_DECLARATION
    }

    struct Evidence {
        bytes32 contentHash;
        bytes32 metadataHash;
        EvidenceType evidenceType;
        uint16 evidenceScoreBps;
        uint16 authenticityScoreBps;
        uint64 capturedAt;
        uint64 committedAt;
        address submitter;
        bool active;
    }

    error ZeroHash();
    error InvalidScore();
    error InvalidTimestamp();
    error EvidenceAlreadyExists(bytes32 evidenceId);
    error UnknownEvidence(bytes32 evidenceId);
    error NotAdmission();

    mapping(address => bool) public admission;
    mapping(bytes32 => Evidence) public evidence;

    event AdmissionSet(address indexed account, bool allowed);
    event EvidenceCommitted(bytes32 indexed evidenceId, bytes32 indexed contentHash, EvidenceType evidenceType, address indexed submitter);
    event EvidenceSuperseded(bytes32 indexed evidenceId);

    modifier onlyAdmission() {
        if (!admission[msg.sender] && msg.sender != owner()) revert NotAdmission();
        _;
    }

    constructor() Ownable() {
        admission[msg.sender] = true;
        emit AdmissionSet(msg.sender, true);
    }

    function setAdmission(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroHash();
        admission[account] = allowed;
        emit AdmissionSet(account, allowed);
    }

    function evidenceIdFor(bytes32 contentHash, bytes32 metadataHash, uint64 capturedAt, address submitter) public pure returns (bytes32) {
        return keccak256(abi.encode(contentHash, metadataHash, capturedAt, submitter));
    }

    function commitEvidence(
        bytes32 contentHash,
        bytes32 metadataHash,
        EvidenceType evidenceType,
        uint16 evidenceScoreBps,
        uint16 authenticityScoreBps,
        uint64 capturedAt
    ) external onlyAdmission returns (bytes32 evidenceId) {
        if (contentHash == bytes32(0) || metadataHash == bytes32(0)) revert ZeroHash();
        if (evidenceScoreBps > 10_000 || authenticityScoreBps > 10_000) revert InvalidScore();
        if (capturedAt == 0 || capturedAt > block.timestamp) revert InvalidTimestamp();
        evidenceId = evidenceIdFor(contentHash, metadataHash, capturedAt, msg.sender);
        if (evidence[evidenceId].committedAt != 0) revert EvidenceAlreadyExists(evidenceId);
        evidence[evidenceId] = Evidence({
            contentHash: contentHash,
            metadataHash: metadataHash,
            evidenceType: evidenceType,
            evidenceScoreBps: evidenceScoreBps,
            authenticityScoreBps: authenticityScoreBps,
            capturedAt: capturedAt,
            committedAt: uint64(block.timestamp),
            submitter: msg.sender,
            active: true
        });
        emit EvidenceCommitted(evidenceId, contentHash, evidenceType, msg.sender);
    }

    function supersedeEvidence(bytes32 evidenceId) external onlyAdmission {
        Evidence storage item = evidence[evidenceId];
        if (item.committedAt == 0) revert UnknownEvidence(evidenceId);
        item.active = false;
        emit EvidenceSuperseded(evidenceId);
    }

    function exists(bytes32 evidenceId) external view returns (bool) {
        return evidence[evidenceId].committedAt != 0;
    }

    function scores(bytes32 evidenceId) external view returns (uint16 evidenceScoreBps, uint16 authenticityScoreBps, bool active) {
        Evidence storage item = evidence[evidenceId];
        if (item.committedAt == 0) revert UnknownEvidence(evidenceId);
        return (item.evidenceScoreBps, item.authenticityScoreBps, item.active);
    }
}
