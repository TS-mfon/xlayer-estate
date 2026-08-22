const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

async function expectRevert(promise, matcher) {
  try {
    await promise;
    assert.fail("Expected transaction to revert");
  } catch (error) {
    assert.match(String(error), new RegExp(matcher));
  }
}

describe("XLayer Estate V2 protocol primitives", function () {
  async function fixture() {
    const [deployer, underwriter, issuer, buyer, agent, outsider] = await ethers.getSigners();
    const evidence = await ethers.deployContract("EvidenceRegistryV2");
    const policy = await ethers.deployContract("RiskPolicyRegistryV2");
    const passport = await ethers.deployContract("AssetPassportRegistryV2", [await evidence.getAddress(), await policy.getAddress()]);
    const registry = await ethers.deployContract("AssetRegistryV2", [await passport.getAddress(), underwriter.address]);
    const usdc = await ethers.deployContract("MockUSDC");
    const market = await ethers.deployContract("AssetMarketV2", [await registry.getAddress(), await usdc.getAddress(), await passport.getAddress(), 1_000]);
    const gateway = await ethers.deployContract("AgentPolicyGatewayV2", [await passport.getAddress(), agent.address]);
    await passport.setAdmission(await registry.getAddress(), true);
    await passport.setAdmission(await gateway.getAddress(), true);
    await usdc.mint(issuer.address, 100_000_000);
    await usdc.mint(buyer.address, 100_000_000);
    const policyId = ethers.keccak256(ethers.toUtf8Bytes("electronics-v1"));
    await policy.setPolicy(policyId, [7_000, 7_000, 6_000, 80, 1_500, 1_000, true]);
    return { deployer, underwriter, issuer, buyer, agent, outsider, evidence, policy, passport, registry, usdc, market, gateway, policyId };
  }

  async function passportFor(context, overrides = {}) {
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("fresh-camera-photo"));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("sanitized-metadata"));
    const capturedAt = BigInt(Math.floor(Date.now() / 1000));
    const evidenceId = await context.evidence.evidenceIdFor(contentHash, metadataHash, capturedAt, context.deployer.address);
    await context.evidence.commitEvidence(contentHash, metadataHash, 0, 9_000, 8_500, capturedAt);
    const assetId = ethers.keccak256(ethers.toUtf8Bytes(overrides.assetName ?? "laptop-1"));
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const version = 1;
    const passportId = await context.passport.passportIdFor(assetId, version);
    await context.passport.commitPassport(assetId, [evidenceId], version, overrides.value ?? 500n * 10n ** 18n, overrides.risk ?? 30, overrides.confidence ?? 8_000, validUntil, context.policyId);
    return { assetId, passportId, evidenceId, metadataHash, validUntil };
  }

  async function mintAuthorization(context, passportId, metadataHash, nonce = 1n) {
    const network = await ethers.provider.getNetwork();
    const message = { to: context.issuer.address, passportId, metadataHash, totalShares: 1_000_000n, nonce, deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) };
    const signature = await context.underwriter.signTypedData(
      { name: "XLayerEstateV2", version: "1", chainId: network.chainId, verifyingContract: await context.registry.getAddress() },
      { Mint: [{ name: "to", type: "address" }, { name: "passportId", type: "bytes32" }, { name: "metadataHash", type: "bytes32" }, { name: "totalShares", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] },
      message,
    );
    return { ...message, signature };
  }

  it("commits evidence and sequential Passport versions under deterministic policy", async function () {
    const context = await fixture();
    const first = await passportFor(context);
    const passport = await context.passport.passports(first.passportId);
    assert.equal(passport.status, 1n);
    await expectRevert(context.passport.commitPassport(first.assetId, [first.evidenceId], 3, 1n, 10, 8_000, first.validUntil, context.policyId), "NonSequentialVersion");
  });

  it("rejects weak evidence and invalid policy decisions", async function () {
    const context = await fixture();
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("weak"));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("weak-meta"));
    const capturedAt = BigInt(Math.floor(Date.now() / 1000));
    const evidenceId = await context.evidence.evidenceIdFor(contentHash, metadataHash, capturedAt, context.deployer.address);
    await context.evidence.commitEvidence(contentHash, metadataHash, 0, 2_000, 2_000, capturedAt);
    await expectRevert(context.passport.commitPassport(ethers.keccak256(ethers.toUtf8Bytes("bad")), [evidenceId], 1, 100n, 90, 1_000, capturedAt + 3600n, context.policyId), "PolicyRejected");
  });

  it("requires a valid Passport and underwriter authorization before issuing shares", async function () {
    const context = await fixture();
    const current = await passportFor(context);
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
    const authorization = await mintAuthorization(context, current.passportId, metadataHash);
    await context.registry.issue(context.issuer.address, current.passportId, metadataHash, "data:application/json;base64,e30=", authorization.totalShares, authorization.nonce, authorization.deadline, authorization.signature);
    assert.equal(await context.registry.balanceOf(context.issuer.address, 1), 1_000_000n);
    await expectRevert(context.registry.issue(context.issuer.address, current.passportId, metadataHash, "data:application/json;base64,e30=", authorization.totalShares, authorization.nonce, authorization.deadline, authorization.signature), "AuthorizationUsed");
    const forged = await mintAuthorization({ ...context, underwriter: context.outsider }, current.passportId, metadataHash, 2n);
    await expectRevert(context.registry.issue(context.issuer.address, current.passportId, metadataHash, "data:application/json;base64,e30=", forged.totalShares, forged.nonce, forged.deadline, forged.signature), "InvalidAuthorization");
  });

  it("blocks arbitrary agent actions and allows only signed risk restrictions", async function () {
    const context = await fixture();
    const current = await passportFor(context);
    const network = await ethers.provider.getNetwork();
    const action = { action: 0, passportId: current.passportId, nonce: 1n, deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) };
    const signature = await context.agent.signTypedData(
      { name: "XLayerEstateAgent", version: "1", chainId: network.chainId, verifyingContract: await context.gateway.getAddress() },
      { AgentAction: [{ name: "action", type: "uint8" }, { name: "passportId", type: "bytes32" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] },
      action,
    );
    await context.gateway.execute(action, signature);
    assert.equal((await context.passport.passports(current.passportId)).status, 2n);
    await expectRevert(context.gateway.execute(action, signature), "NonceUsed");
    const forged = await context.outsider.signTypedData(
      { name: "XLayerEstateAgent", version: "1", chainId: network.chainId, verifyingContract: await context.gateway.getAddress() },
      { AgentAction: [{ name: "action", type: "uint8" }, { name: "passportId", type: "bytes32" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] },
      { ...action, nonce: 2n },
    );
    await expectRevert(context.gateway.execute({ ...action, nonce: 2n }, forged), "InvalidSignature");
  });

  it("creates a bounded pool and rejects high price-impact trades", async function () {
    const context = await fixture();
    const current = await passportFor(context, { value: 50n * 10n ** 18n });
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
    const authorization = await mintAuthorization(context, current.passportId, metadataHash);
    await context.registry.issue(context.issuer.address, current.passportId, metadataHash, "data:application/json;base64,e30=", authorization.totalShares, authorization.nonce, authorization.deadline, authorization.signature);
    await context.registry.connect(context.issuer).setApprovalForAll(await context.market.getAddress(), true);
    await context.usdc.connect(context.issuer).approve(await context.market.getAddress(), 10_000_000);
    await context.market.connect(context.issuer).createPool(1, 10_000_000);
    await context.usdc.connect(context.buyer).approve(await context.market.getAddress(), 100_000_000);
    await expectRevert(context.market.connect(context.buyer).buy(1, 100_000_000, 0, BigInt(Math.floor(Date.now() / 1000) + 600)), "PriceImpactExceeded");
  });

  it("rejects zero trades and returns safe zero quotes for empty inputs", async function () {
    const context = await fixture();
    assert.equal(await context.market.quoteBuy(1, 0), 0n);
    assert.equal(await context.market.quoteSell(1, 0), 0n);
    const current = await passportFor(context);
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
    const authorization = await mintAuthorization(context, current.passportId, metadataHash);
    await context.registry.issue(context.issuer.address, current.passportId, metadataHash, "data:application/json;base64,e30=", authorization.totalShares, authorization.nonce, authorization.deadline, authorization.signature);
    await context.registry.connect(context.issuer).setApprovalForAll(await context.market.getAddress(), true);
    await context.usdc.connect(context.issuer).approve(await context.market.getAddress(), 10_000_000);
    await context.market.connect(context.issuer).createPool(1, 10_000_000);
    await expectRevert(context.market.connect(context.buyer).buy(1, 0, 0, BigInt(Math.floor(Date.now() / 1000) + 600)), "InvalidAmount");
    await expectRevert(context.market.connect(context.buyer).sell(1, 0, 0, BigInt(Math.floor(Date.now() / 1000) + 600)), "InvalidAmount");
  });

  it("uses the deadline-specific error for expired sells", async function () {
    const context = await fixture();
    const current = await passportFor(context);
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
    const authorization = await mintAuthorization(context, current.passportId, metadataHash);
    await context.registry.issue(context.issuer.address, current.passportId, metadataHash, "data:application/json;base64,e30=", authorization.totalShares, authorization.nonce, authorization.deadline, authorization.signature);
    await context.registry.connect(context.issuer).setApprovalForAll(await context.market.getAddress(), true);
    await context.usdc.connect(context.issuer).approve(await context.market.getAddress(), 10_000_000);
    await context.market.connect(context.issuer).createPool(1, 10_000_000);
    await context.registry.connect(context.buyer).setApprovalForAll(await context.market.getAddress(), true);
    await expectRevert(context.market.connect(context.buyer).sell(1, 1, 0, 1), "DeadlineExpired");
  });
});
