import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { erc20Abi, marketplaceAbi, rwaAbi } from "../src/lib/abi";

type AbiEntry = { type: string; name?: string; inputs?: readonly { type: string }[]; outputs?: readonly { type: string }[] };

function artifactAbi(path: string) {
  return (JSON.parse(fs.readFileSync(path, "utf8")) as { abi: AbiEntry[] }).abi;
}

function signature(entry: AbiEntry) {
  return `${entry.type}:${entry.name ?? ""}(${(entry.inputs ?? []).map((input) => input.type).join(",")})`;
}

function assertCompatible(label: string, frontend: readonly AbiEntry[], artifact: AbiEntry[]) {
  const deployed = new Map(artifact.map((entry) => [signature(entry), entry]));
  for (const entry of frontend) {
    const match = deployed.get(signature(entry));
    assert.ok(match, `${label} frontend ABI entry is absent from the compiled contract: ${signature(entry)}`);
    assert.deepEqual((entry.outputs ?? []).map((output) => output.type), (match.outputs ?? []).map((output) => output.type), `${label} output mismatch for ${signature(entry)}`);
  }
}

test("frontend contract ABIs remain compatible with compiled artifacts", () => {
  assertCompatible("RWAAsset", rwaAbi, artifactAbi("artifacts/contracts/RWAAsset.sol/RWAAsset.json"));
  assertCompatible("RWAAMMMarketplace", marketplaceAbi, artifactAbi("artifacts/contracts/RWAAMMMarketplace.sol/RWAAMMMarketplace.json"));
  assertCompatible("MockUSDC", erc20Abi, artifactAbi("artifacts/contracts/MockUSDC.sol/MockUSDC.json"));
});
