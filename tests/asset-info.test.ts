import assert from "node:assert/strict";
import test from "node:test";
import { rwaAbi } from "../src/lib/abi";
import { chunkValues, normalizeAssetInfo, registryTokenIds } from "../src/lib/asset-info";

const tokenFourResult = [
  "0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E",
  50n,
  50n,
  1_000_000n,
  70,
  1,
  "0xe13e95328176a48ac6ceebe70c1562db07413c46706c74204b6ba67ccfcd63b1",
  "0x27f1ef910b48515321487035c7414d203fc7154b35ac6dd82ae6154a4a2e0c4b",
  "data:application/json;base64,asset-four",
  1_786_971_292n,
] as const;

test("assetInfo ABI matches the deployed flat public mapping getter", () => {
  const assetInfo = rwaAbi.find((item) => item.type === "function" && item.name === "assetInfo");

  assert.ok(assetInfo && "outputs" in assetInfo);
  assert.equal(assetInfo.outputs.length, 10);
  assert.equal(assetInfo.outputs[0].name, "owner");
  assert.equal(assetInfo.outputs[8].name, "metadataURI");
  assert.deepEqual(assetInfo.outputs.map((output) => output.type), ["address", "uint256", "uint256", "uint256", "uint8", "uint8", "bytes32", "bytes32", "string", "uint64"]);
});

test("deployed token 4 result normalizes into the UI asset record", () => {
  const info = normalizeAssetInfo(tokenFourResult);

  assert.ok(info);
  assert.equal(info.owner, tokenFourResult[0]);
  assert.equal(info.valuationUsd, 50n);
  assert.equal(info.totalShares, 1_000_000n);
  assert.equal(info.status, 1);
  assert.match(info.metadataURI, /^data:application\/json;base64,/);
});

test("registry enumeration includes every token and batches RPC work", () => {
  const ids = registryTokenIds(4n);

  assert.deepEqual(ids, [1n, 2n, 3n, 4n]);
  assert.deepEqual(chunkValues(ids, 3), [[1n, 2n, 3n], [4n]]);
  assert.deepEqual(registryTokenIds(0n), []);
});

test("zero-address and malformed registry records are rejected", () => {
  assert.equal(normalizeAssetInfo([]), null);
  assert.equal(normalizeAssetInfo(["0x0000000000000000000000000000000000000000", ...tokenFourResult.slice(1)]), null);
});
