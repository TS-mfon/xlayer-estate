// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract RWAAsset is ERC1155, Ownable, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant MINT_AUTHORIZATION_TYPEHASH = keccak256(
        "MintAuthorization(address to,uint256 valuationUsd,uint256 launchValuationUsd,uint8 riskScore,bytes32 underwritingHash,bytes32 metadataHash,uint256 totalShares,uint256 nonce,uint256 deadline)"
    );

    struct AssetInfo {
        address owner;
        uint256 valuationUsd;
        uint256 launchValuationUsd;
        uint256 totalShares;
        uint8 riskScore;
        uint8 status;
        bytes32 underwritingHash;
        bytes32 metadataHash;
        string metadataURI;
        uint64 timestamp;
    }

    address public underwriter;
    uint256 private _nextTokenId = 1;
    mapping(uint256 => AssetInfo) public assetInfo;
    mapping(bytes32 => bool) public usedAuthorizations;

    event AssetTokenized(uint256 indexed tokenId, address indexed owner, uint256 valuationUsd, uint256 launchValuationUsd, uint8 riskScore, bytes32 underwritingHash, bytes32 metadataHash, string metadataURI);
    event AssetStatusChanged(uint256 indexed tokenId, uint8 newStatus);
    event UnderwriterChanged(address indexed previousUnderwriter, address indexed newUnderwriter);

    constructor(address underwriter_) ERC1155("") EIP712("XLayerEstate", "2") {
        require(underwriter_ != address(0), "invalid underwriter");
        underwriter = underwriter_;
    }

    function setUnderwriter(address newUnderwriter) external onlyOwner {
        require(newUnderwriter != address(0), "invalid underwriter");
        emit UnderwriterChanged(underwriter, newUnderwriter);
        underwriter = newUnderwriter;
    }

    function tokenizeProperty(
        address to,
        uint256 valuationUsd,
        uint256 launchValuationUsd,
        uint8 riskScore,
        bytes32 underwritingHash,
        bytes32 metadataHash,
        string calldata metadataURI,
        uint256 totalShares,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256 tokenId) {
        require(block.timestamp <= deadline, "authorization expired");
        require(to != address(0), "invalid recipient");
        require(valuationUsd > 0 && launchValuationUsd > 0 && launchValuationUsd <= valuationUsd, "invalid valuation");
        require(riskScore <= 100, "riskScore > 100");
        require(totalShares > 0, "totalShares = 0");
        require(underwritingHash != bytes32(0) && metadataHash != bytes32(0), "empty hash");
        require(bytes(metadataURI).length > 0, "empty metadataURI");

        bytes32 structHash = keccak256(abi.encode(
            MINT_AUTHORIZATION_TYPEHASH,
            to,
            valuationUsd,
            launchValuationUsd,
            riskScore,
            underwritingHash,
            metadataHash,
            totalShares,
            nonce,
            deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        require(!usedAuthorizations[digest], "authorization used");
        require(digest.recover(signature) == underwriter, "invalid underwriting authorization");
        usedAuthorizations[digest] = true;

        tokenId = _nextTokenId++;
        assetInfo[tokenId] = AssetInfo({
            owner: to,
            valuationUsd: valuationUsd,
            launchValuationUsd: launchValuationUsd,
            totalShares: totalShares,
            riskScore: riskScore,
            status: 1,
            underwritingHash: underwritingHash,
            metadataHash: metadataHash,
            metadataURI: metadataURI,
            timestamp: uint64(block.timestamp)
        });

        _mint(to, tokenId, totalShares, "");
        emit AssetTokenized(tokenId, to, valuationUsd, launchValuationUsd, riskScore, underwritingHash, metadataHash, metadataURI);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId < _nextTokenId, "nonexistent token");
        return assetInfo[tokenId].metadataURI;
    }

    function getAssetMarketData(uint256 tokenId) external view returns (address owner_, uint256 launchValuationUsd, uint256 totalShares, uint8 status) {
        AssetInfo storage info = assetInfo[tokenId];
        require(tokenId > 0 && tokenId < _nextTokenId, "nonexistent token");
        return (info.owner, info.launchValuationUsd, info.totalShares, info.status);
    }

    function setStatus(uint256 tokenId, uint8 newStatus) external {
        require(tokenId > 0 && tokenId < _nextTokenId, "nonexistent token");
        require(msg.sender == owner() || msg.sender == assetInfo[tokenId].owner, "not authorized");
        require(newStatus <= 3, "invalid status");
        assetInfo[tokenId].status = newStatus;
        emit AssetStatusChanged(tokenId, newStatus);
    }

    function totalAssets() external view returns (uint256) { return _nextTokenId - 1; }
}
