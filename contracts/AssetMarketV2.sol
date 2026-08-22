// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./AssetPassportRegistryV2.sol";

interface IAssetRegistryV2Market {
    function assetMarketData(uint256 tokenId) external view returns (address owner_, bytes32 passportId, uint256 totalShares);
}

contract AssetMarketV2 is ERC1155Holder, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MIN_SEED_USDC = 10_000_000;
    uint256 public constant SWAP_FEE_BPS = 30;

    struct Pool {
        uint256 shareReserve;
        uint256 usdcReserve;
        uint256 totalLiquidity;
        uint256 lockedLiquidity;
        bool active;
    }

    IERC1155 public immutable assetToken;
    IERC20 public immutable usdc;
    AssetPassportRegistryV2 public immutable passports;
    uint16 public immutable maxPriceImpactBps;
    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(address => uint256)) public liquidityOf;

    error InvalidAddress();
    error InvalidAmount();
    error PoolExists();
    error PoolInactive();
    error IssuerOnly();
    error PassportRestricted();
    error ReserveTooSmall();
    error SlippageExceeded();
    error PriceImpactExceeded();
    error InsufficientLiquidity();
    error InvalidLiquidity();
    error DeadlineExpired();

    event PoolCreated(uint256 indexed tokenId, address indexed issuer, uint256 shares, uint256 usdc, uint256 lockedLiquidity);
    event SharesBought(uint256 indexed tokenId, address indexed buyer, uint256 usdcIn, uint256 sharesOut, uint256 fee);
    event SharesSold(uint256 indexed tokenId, address indexed seller, uint256 sharesIn, uint256 usdcOut, uint256 fee);
    event LiquidityAdded(uint256 indexed tokenId, address indexed provider, uint256 shares, uint256 usdc, uint256 liquidity);
    event LiquidityRemoved(uint256 indexed tokenId, address indexed provider, uint256 shares, uint256 usdc, uint256 liquidity);

    constructor(IERC1155 assetToken_, IERC20 usdc_, AssetPassportRegistryV2 passports_, uint16 maxPriceImpactBps_) Ownable() {
        if (address(assetToken_) == address(0) || address(usdc_) == address(0) || address(passports_) == address(0) || maxPriceImpactBps_ == 0 || maxPriceImpactBps_ > BPS) revert InvalidAddress();
        assetToken = assetToken_;
        usdc = usdc_;
        passports = passports_;
        maxPriceImpactBps = maxPriceImpactBps_;
    }

    function createPool(uint256 tokenId, uint256 usdcAmount) external nonReentrant whenNotPaused {
        if (usdcAmount < MIN_SEED_USDC) revert ReserveTooSmall();
        Pool storage pool = pools[tokenId];
        if (pool.active) revert PoolExists();
        (address issuer, bytes32 passportId, uint256 totalShares) = IAssetRegistryV2Market(address(assetToken)).assetMarketData(tokenId);
        if (msg.sender != issuer) revert IssuerOnly();
        if (!passports.isMintEligible(passportId)) revert PassportRestricted();
        uint256 shares = (usdcAmount * totalShares) / (usdcAmount + _passportValue(passportId));
        if (shares == 0 || shares > totalShares) shares = totalShares;
        assetToken.safeTransferFrom(msg.sender, address(this), tokenId, shares, "");
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        uint256 liquidity = _sqrt(shares * usdcAmount);
        uint256 locked = liquidity * MIN_SEED_USDC / usdcAmount;
        if (liquidity == 0 || locked == 0 || locked > liquidity) revert InvalidLiquidity();
        pool.shareReserve = shares;
        pool.usdcReserve = usdcAmount;
        pool.totalLiquidity = liquidity;
        pool.lockedLiquidity = locked;
        pool.active = true;
        liquidityOf[tokenId][msg.sender] = liquidity;
        emit PoolCreated(tokenId, msg.sender, shares, usdcAmount, locked);
    }

    function addLiquidity(uint256 tokenId, uint256 shareAmount, uint256 usdcAmount, uint256 minLiquidity) external nonReentrant whenNotPaused returns (uint256 liquidity) {
        Pool storage pool = _activePool(tokenId);
        uint256 sharesRequired = _ceilDiv(usdcAmount * pool.shareReserve, pool.usdcReserve);
        if (shareAmount < sharesRequired || sharesRequired == 0 || usdcAmount == 0) revert InvalidLiquidity();
        uint256 shareLiquidity = sharesRequired * pool.totalLiquidity / pool.shareReserve;
        uint256 usdcLiquidity = usdcAmount * pool.totalLiquidity / pool.usdcReserve;
        liquidity = shareLiquidity < usdcLiquidity ? shareLiquidity : usdcLiquidity;
        if (liquidity < minLiquidity || liquidity == 0) revert InvalidLiquidity();
        assetToken.safeTransferFrom(msg.sender, address(this), tokenId, sharesRequired, "");
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        pool.shareReserve += sharesRequired;
        pool.usdcReserve += usdcAmount;
        pool.totalLiquidity += liquidity;
        liquidityOf[tokenId][msg.sender] += liquidity;
        emit LiquidityAdded(tokenId, msg.sender, sharesRequired, usdcAmount, liquidity);
    }

    function removeLiquidity(uint256 tokenId, uint256 liquidity, uint256 minShares, uint256 minUsdc) external nonReentrant whenNotPaused returns (uint256 shares, uint256 usdcAmount) {
        Pool storage pool = _activePool(tokenId);
        if (liquidity == 0 || liquidityOf[tokenId][msg.sender] < liquidity || pool.totalLiquidity - liquidity < pool.lockedLiquidity) revert InsufficientLiquidity();
        shares = liquidity * pool.shareReserve / pool.totalLiquidity;
        usdcAmount = liquidity * pool.usdcReserve / pool.totalLiquidity;
        if (shares < minShares || usdcAmount < minUsdc) revert SlippageExceeded();
        liquidityOf[tokenId][msg.sender] -= liquidity;
        pool.totalLiquidity -= liquidity;
        pool.shareReserve -= shares;
        pool.usdcReserve -= usdcAmount;
        assetToken.safeTransferFrom(address(this), msg.sender, tokenId, shares, "");
        usdc.safeTransfer(msg.sender, usdcAmount);
        emit LiquidityRemoved(tokenId, msg.sender, shares, usdcAmount, liquidity);
    }

    function buy(uint256 tokenId, uint256 usdcIn, uint256 minSharesOut, uint256 deadline) external nonReentrant whenNotPaused returns (uint256 sharesOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (usdcIn == 0) revert InvalidAmount();
        Pool storage pool = _activePool(tokenId);
        uint256 fee = usdcIn * SWAP_FEE_BPS / BPS;
        uint256 net = usdcIn - fee;
        sharesOut = _quoteBuy(pool.shareReserve, pool.usdcReserve, net);
        if (sharesOut < minSharesOut || sharesOut == 0) revert SlippageExceeded();
        uint256 oldPrice = pool.usdcReserve * 1e18 / pool.shareReserve;
        if (sharesOut >= pool.shareReserve) revert InsufficientLiquidity();
        uint256 newPrice = (pool.usdcReserve + usdcIn) * 1e18 / (pool.shareReserve - sharesOut);
        if (newPrice > oldPrice && (newPrice - oldPrice) * BPS / oldPrice > maxPriceImpactBps) revert PriceImpactExceeded();
        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);
        pool.usdcReserve += usdcIn;
        pool.shareReserve -= sharesOut;
        assetToken.safeTransferFrom(address(this), msg.sender, tokenId, sharesOut, "");
        emit SharesBought(tokenId, msg.sender, usdcIn, sharesOut, fee);
    }

    function sell(uint256 tokenId, uint256 sharesIn, uint256 minUsdcOut, uint256 deadline) external nonReentrant whenNotPaused returns (uint256 usdcOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (sharesIn == 0) revert InvalidAmount();
        Pool storage pool = _activePool(tokenId);
        uint256 gross = _quoteSell(pool.shareReserve, pool.usdcReserve, sharesIn);
        uint256 fee = gross * SWAP_FEE_BPS / BPS;
        usdcOut = gross - fee;
        if (usdcOut < minUsdcOut || usdcOut == 0) revert SlippageExceeded();
        uint256 oldPrice = pool.usdcReserve * 1e18 / pool.shareReserve;
        if (usdcOut >= pool.usdcReserve) revert InsufficientLiquidity();
        uint256 newPrice = (pool.usdcReserve - usdcOut) * 1e18 / (pool.shareReserve + sharesIn);
        if (newPrice < oldPrice && (oldPrice - newPrice) * BPS / oldPrice > maxPriceImpactBps) revert PriceImpactExceeded();
        assetToken.safeTransferFrom(msg.sender, address(this), tokenId, sharesIn, "");
        pool.shareReserve += sharesIn;
        pool.usdcReserve -= usdcOut;
        usdc.safeTransfer(msg.sender, usdcOut);
        emit SharesSold(tokenId, msg.sender, sharesIn, usdcOut, fee);
    }

    function quoteBuy(uint256 tokenId, uint256 usdcIn) external view returns (uint256) {
        Pool memory pool = pools[tokenId];
        if (!pool.active || usdcIn == 0 || pool.shareReserve == 0 || pool.usdcReserve == 0) return 0;
        return _quoteBuy(pool.shareReserve, pool.usdcReserve, usdcIn - (usdcIn * SWAP_FEE_BPS / BPS));
    }

    function quoteSell(uint256 tokenId, uint256 sharesIn) external view returns (uint256) {
        Pool memory pool = pools[tokenId];
        if (!pool.active || sharesIn == 0 || pool.shareReserve == 0 || pool.usdcReserve == 0) return 0;
        uint256 gross = _quoteSell(pool.shareReserve, pool.usdcReserve, sharesIn);
        return gross - (gross * SWAP_FEE_BPS / BPS);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _activePool(uint256 tokenId) internal view returns (Pool storage pool) {
        pool = pools[tokenId];
        if (!pool.active) revert PoolInactive();
        (, bytes32 passportId,) = IAssetRegistryV2Market(address(assetToken)).assetMarketData(tokenId);
        if (!passports.isMintEligible(passportId)) revert PassportRestricted();
    }

    function _passportValue(bytes32 passportId) internal view returns (uint256) {
        (,,, uint256 value,,,,,,) = passports.passports(passportId);
        return value / 1e12;
    }

    function _quoteBuy(uint256 shares, uint256 usdcAmount, uint256 net) internal pure returns (uint256) {
        return shares * net / (usdcAmount + net);
    }

    function _quoteSell(uint256 shares, uint256 usdcAmount, uint256 sharesIn) internal pure returns (uint256) {
        return usdcAmount * sharesIn / (shares + sharesIn);
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) { return a == 0 ? 0 : (a - 1) / b + 1; }

    function _sqrt(uint256 value) internal pure returns (uint256 result) {
        if (value == 0) return 0;
        uint256 x = value;
        result = 1;
        if (x >> 128 > 0) { x >>= 128; result <<= 64; }
        if (x >> 64 > 0) { x >>= 64; result <<= 32; }
        if (x >> 32 > 0) { x >>= 32; result <<= 16; }
        if (x >> 16 > 0) { x >>= 16; result <<= 8; }
        if (x >> 8 > 0) { x >>= 8; result <<= 4; }
        if (x >> 4 > 0) { x >>= 4; result <<= 2; }
        if (x >> 2 > 0) result <<= 1;
        for (uint256 i; i < 7; ++i) result = (result + value / result) >> 1;
        uint256 roundedDown = value / result;
        return result < roundedDown ? result : roundedDown;
    }
}
