const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

async function expectRevert(promise, message) {
  try { await promise; assert.fail("Expected transaction to revert"); }
  catch (error) { assert.match(String(error), new RegExp(message)); }
}

describe("XLayer Estate V2", function () {
  async function fixture() {
    const [deployer, underwriter, issuer, buyer, outsider, feeCollector] = await ethers.getSigners();
    const rwa = await ethers.deployContract("RWAAsset", [underwriter.address]); await rwa.waitForDeployment();
    const usdc = await ethers.deployContract("MockUSDC"); await usdc.waitForDeployment();
    const market = await ethers.deployContract("RWAAMMMarketplace", [await rwa.getAddress(), await usdc.getAddress(), feeCollector.address]); await market.waitForDeployment();
    await usdc.mint(issuer.address, 100_000_000); await usdc.mint(buyer.address, 100_000_000);
    return { deployer, underwriter, issuer, buyer, outsider, feeCollector, rwa, usdc, market };
  }

  async function authorization(rwa, underwriter, to, overrides = {}) {
    const network = await ethers.provider.getNetwork();
    const message = {
      to: to.address,
      valuationUsd: 600_000n,
      launchValuationUsd: 500_000n,
      riskScore: 18,
      underwritingHash: ethers.keccak256(ethers.toUtf8Bytes("report")),
      metadataHash: ethers.keccak256(ethers.toUtf8Bytes("metadata")),
      totalShares: 1_000_000n,
      nonce: 42n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      ...overrides,
    };
    const signature = await underwriter.signTypedData(
      { name: "XLayerEstate", version: "2", chainId: network.chainId, verifyingContract: await rwa.getAddress() },
      { MintAuthorization: [
        { name: "to", type: "address" }, { name: "valuationUsd", type: "uint256" }, { name: "launchValuationUsd", type: "uint256" }, { name: "riskScore", type: "uint8" }, { name: "underwritingHash", type: "bytes32" }, { name: "metadataHash", type: "bytes32" }, { name: "totalShares", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
      ] }, message
    );
    return { ...message, signature };
  }

  async function mintAsset(context) {
    const auth = await authorization(context.rwa, context.underwriter, context.issuer);
    await context.rwa.tokenizeProperty(auth.to, auth.valuationUsd, auth.launchValuationUsd, auth.riskScore, auth.underwritingHash, auth.metadataHash, "ipfs://metadata", auth.totalShares, auth.nonce, auth.deadline, auth.signature);
    return auth;
  }

  it("mints only with a valid, unused underwriting authorization", async function () {
    const context = await fixture(); const auth = await mintAsset(context);
    const info = await context.rwa.assetInfo(1);
    assert.equal(info.owner, context.issuer.address); assert.equal(info.valuationUsd, 600_000n); assert.equal(info.launchValuationUsd, 500_000n); assert.equal(info.totalShares, 1_000_000n);
    await expectRevert(context.rwa.tokenizeProperty(auth.to, auth.valuationUsd, auth.launchValuationUsd, auth.riskScore, auth.underwritingHash, auth.metadataHash, "ipfs://metadata", auth.totalShares, auth.nonce, auth.deadline, auth.signature), "authorization used");
    const forged = await authorization(context.rwa, context.outsider, context.issuer, { nonce: 43n });
    await expectRevert(context.rwa.tokenizeProperty(forged.to, forged.valuationUsd, forged.launchValuationUsd, forged.riskScore, forged.underwritingHash, forged.metadataHash, "ipfs://metadata", forged.totalShares, forged.nonce, forged.deadline, forged.signature), "invalid underwriting authorization");
  });

  it("anchors the initial pool to valuation and locks the first 10 USDC", async function () {
    const context = await fixture(); await mintAsset(context);
    await context.rwa.connect(context.issuer).setApprovalForAll(await context.market.getAddress(), true);
    await context.usdc.connect(context.issuer).approve(await context.market.getAddress(), 10_200_000);
    await context.market.connect(context.issuer).createPool(1, 10_000_000);
    const pool = await context.market.pools(1);
    assert.equal(pool.shareReserve, 20n); assert.equal(pool.usdcReserve, 10_000_000n); assert.equal(pool.totalLiquidity, pool.lockedLiquidity); assert.equal(await context.market.liquidityOf(1, context.issuer.address), 0n);
    assert.equal(await context.usdc.balanceOf(context.feeCollector.address), 200_000n);
  });

  it("buys and sells shares while preserving nonzero reserves", async function () {
    const context = await fixture(); await mintAsset(context);
    await context.rwa.connect(context.issuer).setApprovalForAll(await context.market.getAddress(), true); await context.usdc.connect(context.issuer).approve(await context.market.getAddress(), 10_200_000); await context.market.connect(context.issuer).createPool(1, 10_000_000);
    await context.usdc.connect(context.buyer).approve(await context.market.getAddress(), 2_000_000);
    const quotedShares = await context.market.quoteBuy(1, 2_000_000); assert.ok(quotedShares > 0n);
    await context.market.connect(context.buyer).buy(1, 2_000_000, quotedShares, BigInt(Math.floor(Date.now() / 1000) + 600));
    assert.equal(await context.rwa.balanceOf(context.buyer.address, 1), quotedShares);
    assert.equal(await context.usdc.balanceOf(context.feeCollector.address), 400_000n);
    await context.rwa.connect(context.buyer).setApprovalForAll(await context.market.getAddress(), true);
    const quotedUsdc = await context.market.quoteSell(1, quotedShares); assert.ok(quotedUsdc > 0n);
    await context.market.connect(context.buyer).sell(1, quotedShares, quotedUsdc, BigInt(Math.floor(Date.now() / 1000) + 600));
    const pool = await context.market.pools(1); assert.ok(pool.shareReserve > 0n && pool.usdcReserve > 0n);
    assert.equal(await context.usdc.balanceOf(context.feeCollector.address), 600_000n);
  });

  it("blocks non-issuers, sub-$10 seeds, and expired trades", async function () {
    const context = await fixture(); await mintAsset(context);
    await expectRevert(context.market.connect(context.outsider).createPool(1, 10_000_000), "issuer only");
    await expectRevert(context.market.connect(context.issuer).createPool(1, 9_999_999), "seed below");
    await expectRevert(context.market.connect(context.buyer).buy(1, 200_000, 0, BigInt(Math.floor(Date.now() / 1000) + 600)), "trade below fee");
  });

  it("supports low-value physical assets with the $10 market floor", async function () {
    const context = await fixture();
    const auth = await authorization(context.rwa, context.underwriter, context.issuer, { valuationUsd: 5n, launchValuationUsd: 4n, nonce: 99n });
    await context.rwa.tokenizeProperty(auth.to, auth.valuationUsd, auth.launchValuationUsd, auth.riskScore, auth.underwritingHash, auth.metadataHash, "ipfs://cup", auth.totalShares, auth.nonce, auth.deadline, auth.signature);
    await context.rwa.connect(context.issuer).setApprovalForAll(await context.market.getAddress(), true);
    await context.usdc.connect(context.issuer).approve(await context.market.getAddress(), 10_200_000);
    await context.market.connect(context.issuer).createPool(1, 10_000_000);
    const pool = await context.market.pools(1);
    assert.equal(pool.shareReserve, 1_000_000n);
    assert.equal(pool.usdcReserve, 10_000_000n);
  });

  it("allows approval before funding but blocks pool creation until seed plus fee are available", async function () {
    const context = await fixture(); await mintAsset(context);
    await context.usdc.connect(context.issuer).transfer(context.outsider.address, 90_000_000);
    assert.equal(await context.usdc.balanceOf(context.issuer.address), 10_000_000n);
    await context.rwa.connect(context.issuer).setApprovalForAll(await context.market.getAddress(), true);
    await context.usdc.connect(context.issuer).approve(await context.market.getAddress(), 10_200_000);
    assert.equal(await context.usdc.allowance(context.issuer.address, await context.market.getAddress()), 10_200_000n);
    await expectRevert(context.market.connect(context.issuer).createPool(1, 10_000_000), "ERC20: transfer amount exceeds balance");
    await context.usdc.mint(context.issuer.address, 200_000);
    await context.market.connect(context.issuer).createPool(1, 10_000_000);
    assert.equal((await context.market.pools(1)).active, true);
  });

  it("adds and removes only provider-owned liquidity while preserving the locked floor", async function () {
    const context = await fixture(); await mintAsset(context);
    const market = await context.market.getAddress();
    await context.rwa.connect(context.issuer).setApprovalForAll(market, true);
    await context.usdc.connect(context.issuer).approve(market, 30_200_000);
    await context.market.connect(context.issuer).createPool(1, 10_000_000);
    await context.market.connect(context.issuer).addLiquidity(1, 40, 20_000_000, 0);
    const providerLiquidity = await context.market.liquidityOf(1, context.issuer.address);
    assert.ok(providerLiquidity > 0n);
    await expectRevert(context.market.connect(context.outsider).removeLiquidity(1, 1, 0, 0), "insufficient LP");
    await context.market.connect(context.issuer).removeLiquidity(1, providerLiquidity, 0, 0);
    const pool = await context.market.pools(1);
    assert.equal(pool.totalLiquidity, pool.lockedLiquidity);
    assert.ok(pool.shareReserve > 0n && pool.usdcReserve > 0n);
  });

  it("honors asset status and marketplace pause controls", async function () {
    const context = await fixture(); await mintAsset(context);
    const market = await context.market.getAddress();
    await context.rwa.connect(context.issuer).setApprovalForAll(market, true);
    await context.usdc.connect(context.issuer).approve(market, 10_200_000);
    await context.market.pause();
    await expectRevert(context.market.connect(context.issuer).createPool(1, 10_000_000), "Pausable: paused");
    await context.market.unpause();
    await context.market.connect(context.issuer).createPool(1, 10_000_000);
    await context.rwa.connect(context.issuer).setStatus(1, 2);
    await expectRevert(context.market.connect(context.buyer).buy(1, 1_000_000, 0, BigInt(Math.floor(Date.now() / 1000) + 600)), "asset not active");
    await context.rwa.connect(context.issuer).setStatus(1, 1);
    assert.ok(await context.market.quoteBuy(1, 1_000_000) > 0n);
  });

  it("rotates the underwriter without accepting signatures from the previous signer", async function () {
    const context = await fixture();
    await context.rwa.setUnderwriter(context.outsider.address);
    const oldAuthorization = await authorization(context.rwa, context.underwriter, context.issuer, { nonce: 501n });
    await expectRevert(context.rwa.tokenizeProperty(oldAuthorization.to, oldAuthorization.valuationUsd, oldAuthorization.launchValuationUsd, oldAuthorization.riskScore, oldAuthorization.underwritingHash, oldAuthorization.metadataHash, "ipfs://old", oldAuthorization.totalShares, oldAuthorization.nonce, oldAuthorization.deadline, oldAuthorization.signature), "invalid underwriting authorization");
    const newAuthorization = await authorization(context.rwa, context.outsider, context.issuer, { nonce: 502n });
    await context.rwa.tokenizeProperty(newAuthorization.to, newAuthorization.valuationUsd, newAuthorization.launchValuationUsd, newAuthorization.riskScore, newAuthorization.underwritingHash, newAuthorization.metadataHash, "ipfs://new", newAuthorization.totalShares, newAuthorization.nonce, newAuthorization.deadline, newAuthorization.signature);
    assert.equal(await context.rwa.balanceOf(context.issuer.address, 1), 1_000_000n);
  });
});
