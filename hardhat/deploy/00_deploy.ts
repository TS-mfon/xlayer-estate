import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying RWAAsset with account:", deployer.address);

  const RWAAsset = await ethers.getContractFactory("RWAAsset");
  const contract = await RWAAsset.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("RWAAsset deployed to:", address);
  console.log("Set NEXT_PUBLIC_RWA_ADDRESS=" + address + " in your .env.local");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
