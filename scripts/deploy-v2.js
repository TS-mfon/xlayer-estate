const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.build") });
const { ContractFactory, JsonRpcProvider, Wallet } = require("ethers");

const RPC = process.env.XLAYER_TESTNET_RPC || "https://xlayer-testnet.drpc.org";
const USDC = process.env.USDC_ADDRESS || "0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d";
const FEE_COLLECTOR = process.env.FEE_COLLECTOR || "0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E";

function artifact(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`), "utf8"));
}

async function main() {
  if (!process.env.PRIVATE_KEY || !process.env.UNDERWRITER_ADDRESS) throw new Error("PRIVATE_KEY and UNDERWRITER_ADDRESS are required");
  const provider = new JsonRpcProvider(RPC, { chainId: 1952, name: "xlayer-testnet" }, { staticNetwork: true });
  const deployer = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log("deployer:", deployer.address);
  console.log("underwriter:", process.env.UNDERWRITER_ADDRESS);
  console.log("USDC_TEST:", USDC);

  const rwaArtifact = artifact("RWAAsset");
  const rwa = await new ContractFactory(rwaArtifact.abi, rwaArtifact.bytecode, deployer).deploy(process.env.UNDERWRITER_ADDRESS);
  await rwa.waitForDeployment();
  const rwaAddress = await rwa.getAddress();
  console.log("RWAAsset V2:", rwaAddress);

  const marketArtifact = artifact("RWAAMMMarketplace");
  const market = await new ContractFactory(marketArtifact.abi, marketArtifact.bytecode, deployer).deploy(rwaAddress, USDC, FEE_COLLECTOR);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("RWAAMMMarketplace:", marketAddress);
  console.log(`NEXT_PUBLIC_RWA_ADDRESS=${rwaAddress}`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_ADDRESS=${marketAddress}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${USDC}`);
  console.log(`NEXT_PUBLIC_FEE_COLLECTOR=${FEE_COLLECTOR}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
