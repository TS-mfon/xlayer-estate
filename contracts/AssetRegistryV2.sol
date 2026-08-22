// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./AssetPassportRegistryV2.sol";

contract AssetRegistryV2 is ERC1155, EIP712, Ownable {
    using ECDSA for bytes32;

    bytes32 public constant MINT_TYPEHASH = keccak256("Mint(address to,bytes32 passportId,bytes32 metadataHash,uint256 totalShares,uint256 nonce,uint256 deadline)");

    AssetPassportRegistryV2 public immutable passports;
    address public underwriter;
    uint256 public nextTokenId = 1;
    mapping(bytes32 => bool) public usedAuthorizations;
    mapping(uint256 => bytes32) public passportOf;
    mapping(uint256 => address) public assetOwner;
    mapping(uint256 => uint256) public totalSharesOf;
    mapping(uint256 => string) private _metadata;

    error InvalidAddress();
    error AuthorizationExpired();
    error AuthorizationUsed();
    error InvalidAuthorization();
    error InvalidShares();
    error InvalidMetadata();
    error PassportNotEligible();

    event UnderwriterChanged(address indexed previousUnderwriter, address indexed newUnderwriter);
    event AssetIssued(uint256 indexed tokenId, bytes32 indexed passportId, address indexed recipient, uint256 totalShares, bytes32 metadataHash, string metadataURI);

    constructor(AssetPassportRegistryV2 passports_, address underwriter_) ERC1155("") EIP712("XLayerEstateV2", "1") Ownable() {
        if (address(passports_) == address(0) || underwriter_ == address(0)) revert InvalidAddress();
        passports = passports_;
        underwriter = underwriter_;
    }

    function setUnderwriter(address newUnderwriter) external onlyOwner {
        if (newUnderwriter == address(0)) revert InvalidAddress();
        emit UnderwriterChanged(underwriter, newUnderwriter);
        underwriter = newUnderwriter;
    }

    function issue(
        address to,
        bytes32 passportId,
        bytes32 metadataHash,
        string calldata metadataURI,
        uint256 totalShares,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256 tokenId) {
        if (to == address(0)) revert InvalidAddress();
        if (deadline < block.timestamp) revert AuthorizationExpired();
        if (totalShares == 0 || metadataHash == bytes32(0) || bytes(metadataURI).length == 0) revert InvalidShares();
        if (!passports.isMintEligible(passportId)) revert PassportNotEligible();
        bytes32 structHash = keccak256(abi.encode(MINT_TYPEHASH, to, passportId, metadataHash, totalShares, nonce, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        if (usedAuthorizations[digest]) revert AuthorizationUsed();
        if (digest.recover(signature) != underwriter) revert InvalidAuthorization();
        usedAuthorizations[digest] = true;
        tokenId = nextTokenId++;
        passportOf[tokenId] = passportId;
        assetOwner[tokenId] = to;
        totalSharesOf[tokenId] = totalShares;
        _metadata[tokenId] = metadataURI;
        _mint(to, tokenId, totalShares, "");
        emit AssetIssued(tokenId, passportId, to, totalShares, metadataHash, metadataURI);
    }

    function assetMarketData(uint256 tokenId) external view returns (address owner_, bytes32 passportId, uint256 totalShares) {
        owner_ = assetOwner[tokenId];
        if (owner_ == address(0)) revert InvalidMetadata();
        return (owner_, passportOf[tokenId], totalSharesOf[tokenId]);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        if (bytes(_metadata[tokenId]).length == 0) revert InvalidMetadata();
        return _metadata[tokenId];
    }
}
