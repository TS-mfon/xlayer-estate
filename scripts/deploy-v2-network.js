const fs = require("fs");
const path = require("path");
const { ContractFactory, JsonRpcProvider, Wallet } = require("ethers");
const { keccak256, toUtf8Bytes } = require("ethers");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.build") });

const target = process.argv[2] || "testnet";
const isMainnet = target === "mainnet";
if (!["testnet", "mainnet"].includes(target)) throw new Error("Usage: node scripts/deploy-v2-network.js <testnet|mainnet>");
if (isMainnet && process.env.CONFIRM_MAINNET_DEPLOY !== "YES") throw new Error("Refusing mainnet deployment. Set CONFIRM_MAINNET_DEPLOY=YES after reviewing the V2 preflight output.");

const chainId = isMainnet ? 196 : 1952;
const rpc = isMainnet ? (process.env.XLAYER_MAINNET_RPC || "https://rpc.xlayer.tech") : (process.env.XLAYER_TESTNET_RPC || "https://xlayer-testnet.drpc.org");
const underwriter = process.env.UNDERWRITER_ADDRESS || "";
const agent = process.env.AGENT_ADDRESS || underwriter;

function artifact(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`), "utf8"));
}

function requiredAddress(name, value) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value || "") || /^0x0{40}$/.test(value)) throw new Error(`${name} must be a non-zero EVM address`);
}

async function deploy(name, args, wallet) {
  const item = artifact(name);
  const contract = await new ContractFactory(item.abi, item.bytecode, wallet).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required in .env.build");
  requiredAddress("UNDERWRITER_ADDRESS", underwriter);
  requiredAddress("AGENT_ADDRESS", agent);
  const provider = new JsonRpcProvider(rpc, { chainId, name: isMainnet ? "xlayer" : "xlayer-testnet" }, { staticNetwork: true, batchMaxCount: 1 });
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chainId) throw new Error(`RPC returned chain ${network.chainId}; expected ${chainId}`);

  const evidence = await deploy("EvidenceRegistryV2", [], wallet);
  const policy = await deploy("RiskPolicyRegistryV2", [], wallet);
  const passport = await deploy("AssetPassportRegistryV2", [await evidence.getAddress(), await policy.getAddress()], wallet);
  const registry = await deploy("AssetRegistryV2", [await passport.getAddress(), underwriter], wallet);
  const settlementToken = process.env[isMainnet ? "MAINNET_USDC_ADDRESS" : "USDC_ADDRESS"] || process.env[isMainnet ? "NEXT_PUBLIC_MAINNET_USDC_ADDRESS" : "NEXT_PUBLIC_USDC_ADDRESS"] || "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(settlementToken) || /^0x0{40}$/.test(settlementToken)) throw new Error("A configured settlement token address is required for V2 market deployment");
  const market = await deploy("AssetMarketV2", [await registry.getAddress(), settlementToken, await passport.getAddress(), 1_000], wallet);
  const gateway = await deploy("AgentPolicyGatewayV2", [await passport.getAddress(), agent], wallet);
  const policyId = keccak256(toUtf8Bytes("physical-asset-v2"));
  await (await policy.setPolicy(policyId, [7_000, 7_000, 6_000, 80, 1_500, 1_000, true])).wait();
  await (await evidence.setAdmission(await passport.getAddress(), true)).wait();
  await (await passport.setAdmission(await registry.getAddress(), true)).wait();
  await (await passport.setAdmission(await gateway.getAddress(), true)).wait();
  const block = await provider.getBlockNumber();
  console.log(JSON.stringify({ target, chainId, deployer: wallet.address, deploymentBlock: block, policyId, v2: { evidence: await evidence.getAddress(), policy: await policy.getAddress(), passport: await passport.getAddress(), registry: await registry.getAddress(), market: await market.getAddress(), gateway: await gateway.getAddress() } }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
