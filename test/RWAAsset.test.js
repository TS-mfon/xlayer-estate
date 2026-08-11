const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

async function expectRevert(promise, message) {
  try {
    await promise;
    assert.fail("Expected transaction to revert");
  } catch (error) {
    assert.match(String(error), new RegExp(message));
  }
}

describe("RWAAsset", function () {
  async function deployFixture() {
    const [owner, assetOwner, outsider] = await ethers.getSigners();
    const contract = await ethers.deployContract("RWAAsset");
    await contract.waitForDeployment();
    return { contract, owner, assetOwner, outsider };
  }

  it("tokenizes a property and exposes its registry data", async function () {
    const { contract, assetOwner } = await deployFixture();
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes('{"valuation":1200000}'));
    await contract.tokenizeProperty(assetOwner.address, 1_200_000, 18, reportHash, "ipfs://report", 1_000_000);

    const info = await contract.assetInfo(1);
    assert.equal(info.owner, assetOwner.address);
    assert.equal(info.valuationUsd, 1_200_000n);
    assert.equal(info.riskScore, 18n);
    assert.equal(info.underwritingHash, reportHash);
    assert.equal(await contract.balanceOf(assetOwner.address, 1), 1_000_000n);
    assert.equal(await contract.uri(1), "ipfs://report");
    assert.equal(await contract.totalAssets(), 1n);
  });

  it("rejects invalid mint inputs and lifecycle statuses", async function () {
    const { contract, assetOwner } = await deployFixture();
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("report"));
    await expectRevert(contract.tokenizeProperty(ethers.ZeroAddress, 10, 5, reportHash, "ipfs://report", 1), "invalid recipient");
    await expectRevert(contract.tokenizeProperty(assetOwner.address, 10, 101, reportHash, "ipfs://report", 1), "riskScore > 100");
    await contract.tokenizeProperty(assetOwner.address, 10, 5, reportHash, "ipfs://report", 1);
    await expectRevert(contract.connect(assetOwner).setStatus(1, 4), "invalid status");
  });

  it("limits status changes to the contract or asset owner", async function () {
    const { contract, assetOwner, outsider } = await deployFixture();
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("report"));
    await contract.tokenizeProperty(assetOwner.address, 10, 5, reportHash, "ipfs://report", 1);
    await expectRevert(contract.connect(outsider).setStatus(1, 2), "not authorized");
    await contract.connect(assetOwner).setStatus(1, 2);
    assert.equal((await contract.assetInfo(1)).status, 2n);
  });
});
