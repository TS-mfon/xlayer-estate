// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RWAAsset — AI-underwritten Real Estate Tokenization
/// @notice Each tokenized real-estate asset is one ERC-1155 id. The full supply
///         represents fractional ownership shares minted to the owner. On-chain we
///         store the AI underwriting summary (valuation, risk score, status) plus a
///         keccak256 hash of the full underwriting report for tamper-evidence.
contract RWAAsset is ERC1155, Ownable {
    // ---- Asset registry ---------------------------------------------------
    struct AssetInfo {
        address owner;
        uint256 valuationUsd; // AI-estimated fair value (USD, 18dp not needed)
        uint8 riskScore; // 0 (safe) .. 100 (high risk)
        uint8 status; // 0 pending, 1 active, 2 flagged, 3 retired
        bytes32 underwritingHash; // keccak256 of the full AI report JSON
        string metadataURI; // IPFS / gateway URI to the report
        uint64 timestamp; // block timestamp of tokenization
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => AssetInfo) public assetInfo;

    event AssetTokenized(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 valuationUsd,
        uint8 riskScore,
        bytes32 underwritingHash,
        string metadataURI
    );
    event AssetStatusChanged(uint256 indexed tokenId, uint8 newStatus);

    constructor() ERC1155("") {}

    /// @notice Tokenize a real-estate asset as an ERC-1155 with `totalShares` fractions.
    /// @dev `underwritingHash` is the keccak256 of the canonical AI report JSON.
    function tokenizeProperty(
        address to,
        uint256 valuationUsd,
        uint8 riskScore,
        bytes32 underwritingHash,
        string calldata metadataURI,
        uint256 totalShares
    ) external returns (uint256 tokenId) {
        require(riskScore <= 100, "riskScore > 100");
        require(to != address(0), "invalid recipient");
        require(totalShares > 0, "totalShares = 0");
        require(underwritingHash != bytes32(0), "empty hash");
        require(bytes(metadataURI).length > 0, "empty metadataURI");

        tokenId = _nextTokenId++;
        assetInfo[tokenId] = AssetInfo({
            owner: to,
            valuationUsd: valuationUsd,
            riskScore: riskScore,
            status: 1,
            underwritingHash: underwritingHash,
            metadataURI: metadataURI,
            timestamp: uint64(block.timestamp)
        });

        _mint(to, tokenId, totalShares, "");
        emit AssetTokenized(tokenId, to, valuationUsd, riskScore, underwritingHash, metadataURI);
    }

    /// @notice Override so each asset id points at its AI report metadata.
    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId < _nextTokenId, "nonexistent token");
        return assetInfo[tokenId].metadataURI;
    }

    /// @notice Owner or asset owner can flip lifecycle status (e.g. flag/retire).
    function setStatus(uint256 tokenId, uint8 newStatus) external {
        require(tokenId > 0 && tokenId < _nextTokenId, "nonexistent token");
        require(msg.sender == owner() || msg.sender == assetInfo[tokenId].owner, "not authorized");
        require(newStatus <= 3, "invalid status");
        assetInfo[tokenId].status = newStatus;
        emit AssetStatusChanged(tokenId, newStatus);
    }

    /// @notice Total number of tokenized assets.
    function totalAssets() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}
