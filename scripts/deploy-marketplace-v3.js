const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.build") });
const { ContractFactory, JsonRpcProvider, Wallet } = require("ethers");

const RPC = process.env.XLAYER_TESTNET_RPC || "https://195.rpc.thirdweb.com";
const RWA = process.env.RWA_ADDRESS || process.env.NEXT_PUBLIC_RWA_ADDRESS || "0xc90197fBAe660e0f4b091b4f5E0215fEE0336A67";
const USDC = process.env.USDC_ADDRESS || "0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d";
const FEE_COLLECTOR = process.env.FEE_COLLECTOR || "0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E";

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required in .env.build");
  const artifactPath = path.resolve(__dirname, "../artifacts/contracts/RWAAMMMarketplace.sol/RWAAMMMarketplace.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const provider = new JsonRpcProvider(RPC, { chainId: 1952, name: "xlayer-testnet" }, { staticNetwork: true });
  const deployer = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log("deployer:", deployer.address);
  console.log("registry:", RWA);
  console.log("USDC_TEST:", USDC);
  console.log("fee collector:", FEE_COLLECTOR);
  const market = await new ContractFactory(artifact.abi, artifact.bytecode, deployer).deploy(RWA, USDC, FEE_COLLECTOR);
  await market.waitForDeployment();
  const address = await market.getAddress();
  console.log("RWAAMMMarketplace V3:", address);
  console.log(`NEXT_PUBLIC_MARKETPLACE_ADDRESS=${address}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
