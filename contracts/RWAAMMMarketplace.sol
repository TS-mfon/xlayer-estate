// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IRWAAssetMarketData {
    function getAssetMarketData(uint256 tokenId) external view returns (address owner_, uint256 launchValuationUsd, uint256 totalShares, uint8 status);
}

contract RWAAMMMarketplace is ERC1155Holder, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant MIN_SEED_USDC = 10_000_000;
    uint256 public constant FEE_BPS = 30;
    uint256 public constant BPS = 10_000;

    struct Pool {
        uint256 shareReserve;
        uint256 usdcReserve;
        uint256 totalLiquidity;
        uint256 lockedLiquidity;
        bool active;
    }

    IERC1155 public immutable rwa;
    IERC20Metadata public immutable usdc;
    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(address => uint256)) public liquidityOf;

    event PoolCreated(uint256 indexed tokenId, address indexed creator, uint256 shares, uint256 usdc, uint256 lockedLiquidity);
    event SharesPurchased(uint256 indexed tokenId, address indexed buyer, uint256 usdcIn, uint256 sharesOut, uint256 fee);
    event SharesSold(uint256 indexed tokenId, address indexed seller, uint256 sharesIn, uint256 usdcOut, uint256 fee);
    event LiquidityAdded(uint256 indexed tokenId, address indexed provider, uint256 shares, uint256 usdc, uint256 liquidity);
    event LiquidityRemoved(uint256 indexed tokenId, address indexed provider, uint256 shares, uint256 usdc, uint256 liquidity);

    constructor(address rwa_, address usdc_) {
        require(rwa_ != address(0) && usdc_ != address(0), "invalid token");
        require(IERC20Metadata(usdc_).decimals() == 6, "USDC must use 6 decimals");
        rwa = IERC1155(rwa_);
        usdc = IERC20Metadata(usdc_);
    }

    function createPool(uint256 tokenId, uint256 usdcAmount) external nonReentrant whenNotPaused {
        require(usdcAmount >= MIN_SEED_USDC, "seed below $10");
        Pool storage pool = pools[tokenId];
        require(!pool.active, "pool exists");
        (address issuer, uint256 launchValuation, uint256 totalShares, uint8 status) = IRWAAssetMarketData(address(rwa)).getAssetMarketData(tokenId);
        require(status == 1, "asset not active");
        require(msg.sender == issuer, "issuer only");
        uint256 shares = _sharesForUsdc(usdcAmount, launchValuation, totalShares);
        require(shares > 0, "seed too small");
        rwa.safeTransferFrom(msg.sender, address(this), tokenId, shares, "");
        IERC20(address(usdc)).safeTransferFrom(msg.sender, address(this), usdcAmount);

        uint256 liquidity = _sqrt(shares * usdcAmount);
        uint256 locked = liquidity * MIN_SEED_USDC / usdcAmount;
        pool.shareReserve = shares;
        pool.usdcReserve = usdcAmount;
        pool.totalLiquidity = liquidity;
        pool.lockedLiquidity = locked;
        pool.active = true;
        liquidityOf[tokenId][msg.sender] = liquidity - locked;
        emit PoolCreated(tokenId, msg.sender, shares, usdcAmount, locked);
    }

    function addLiquidity(uint256 tokenId, uint256 shareAmount, uint256 usdcAmount, uint256 minLiquidity) external nonReentrant whenNotPaused returns (uint256 liquidity) {
        Pool storage pool = _activePool(tokenId);
        uint256 sharesRequired = (usdcAmount * pool.shareReserve + pool.usdcReserve - 1) / pool.usdcReserve;
        require(shareAmount >= sharesRequired, "insufficient shares");
        uint256 shareLiquidity = shareAmount * pool.totalLiquidity / pool.shareReserve;
        uint256 usdcLiquidity = usdcAmount * pool.totalLiquidity / pool.usdcReserve;
        liquidity = shareLiquidity < usdcLiquidity ? shareLiquidity : usdcLiquidity;
        require(liquidity >= minLiquidity && liquidity > 0, "liquidity below minimum");
        rwa.safeTransferFrom(msg.sender, address(this), tokenId, sharesRequired, "");
        IERC20(address(usdc)).safeTransferFrom(msg.sender, address(this), usdcAmount);
        pool.shareReserve += sharesRequired;
        pool.usdcReserve += usdcAmount;
        pool.totalLiquidity += liquidity;
        liquidityOf[tokenId][msg.sender] += liquidity;
        emit LiquidityAdded(tokenId, msg.sender, sharesRequired, usdcAmount, liquidity);
    }

    function removeLiquidity(uint256 tokenId, uint256 liquidity, uint256 minShares, uint256 minUsdc) external nonReentrant returns (uint256 shares, uint256 usdcAmount) {
        Pool storage pool = _activePool(tokenId);
        require(liquidity > 0 && liquidityOf[tokenId][msg.sender] >= liquidity, "insufficient LP");
        require(pool.totalLiquidity - liquidity >= pool.lockedLiquidity, "minimum liquidity locked");
        shares = liquidity * pool.shareReserve / pool.totalLiquidity;
        usdcAmount = liquidity * pool.usdcReserve / pool.totalLiquidity;
        require(shares >= minShares && usdcAmount >= minUsdc, "withdrawal slippage");
        liquidityOf[tokenId][msg.sender] -= liquidity;
        pool.totalLiquidity -= liquidity;
        pool.shareReserve -= shares;
        pool.usdcReserve -= usdcAmount;
        rwa.safeTransferFrom(address(this), msg.sender, tokenId, shares, "");
        IERC20(address(usdc)).safeTransfer(msg.sender, usdcAmount);
        emit LiquidityRemoved(tokenId, msg.sender, shares, usdcAmount, liquidity);
    }

    function buy(uint256 tokenId, uint256 usdcIn, uint256 minSharesOut, uint256 deadline) external nonReentrant whenNotPaused returns (uint256 sharesOut) {
        require(block.timestamp <= deadline, "trade expired");
        Pool storage pool = _activePool(tokenId);
        uint256 afterFee = usdcIn * (BPS - FEE_BPS) / BPS;
        sharesOut = pool.shareReserve * afterFee / (pool.usdcReserve + afterFee);
        require(sharesOut >= minSharesOut && sharesOut > 0, "buy slippage");
        IERC20(address(usdc)).safeTransferFrom(msg.sender, address(this), usdcIn);
        pool.usdcReserve += usdcIn;
        pool.shareReserve -= sharesOut;
        rwa.safeTransferFrom(address(this), msg.sender, tokenId, sharesOut, "");
        emit SharesPurchased(tokenId, msg.sender, usdcIn, sharesOut, usdcIn - afterFee);
    }

    function sell(uint256 tokenId, uint256 sharesIn, uint256 minUsdcOut, uint256 deadline) external nonReentrant whenNotPaused returns (uint256 usdcOut) {
        require(block.timestamp <= deadline, "trade expired");
        Pool storage pool = _activePool(tokenId);
        uint256 afterFee = sharesIn * (BPS - FEE_BPS) / BPS;
        usdcOut = pool.usdcReserve * afterFee / (pool.shareReserve + afterFee);
        require(usdcOut >= minUsdcOut && usdcOut > 0, "sell slippage");
        rwa.safeTransferFrom(msg.sender, address(this), tokenId, sharesIn, "");
        pool.shareReserve += sharesIn;
        pool.usdcReserve -= usdcOut;
        IERC20(address(usdc)).safeTransfer(msg.sender, usdcOut);
        emit SharesSold(tokenId, msg.sender, sharesIn, usdcOut, sharesIn - afterFee);
    }

    function quoteBuy(uint256 tokenId, uint256 usdcIn) external view returns (uint256) {
        Pool storage pool = pools[tokenId];
        uint256 afterFee = usdcIn * (BPS - FEE_BPS) / BPS;
        return pool.shareReserve * afterFee / (pool.usdcReserve + afterFee);
    }

    function quoteSell(uint256 tokenId, uint256 sharesIn) external view returns (uint256) {
        Pool storage pool = pools[tokenId];
        uint256 afterFee = sharesIn * (BPS - FEE_BPS) / BPS;
        return pool.usdcReserve * afterFee / (pool.shareReserve + afterFee);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _activePool(uint256 tokenId) internal view returns (Pool storage pool) {
        pool = pools[tokenId];
        require(pool.active, "pool inactive");
        (, , , uint8 status) = IRWAAssetMarketData(address(rwa)).getAssetMarketData(tokenId);
        require(status == 1, "asset not active");
    }

    function _sharesForUsdc(uint256 usdcAmount, uint256 valuation, uint256 totalShares) internal pure returns (uint256) {
        return usdcAmount * totalShares / (valuation * 1e6);
    }

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
        for (uint256 i = 0; i < 7; i++) result = (result + value / result) >> 1;
        uint256 roundedDown = value / result;
        return result < roundedDown ? result : roundedDown;
    }
}
