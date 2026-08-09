import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

// Deploy credentials live in the parent project's .env.build (separate from the
// Next.js app env) so the funded testnet key never leaks into frontend config.
dotenv.config({ path: "../.env.build" });

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const testnetRpc = process.env.XLAYER_TESTNET_RPC ?? "https://195.rpc.thirdweb.com";
const mainnetRpc = process.env.XLAYER_MAINNET_RPC ?? "https://rpc.xlayer.tech";

const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    xlayerTestnet: {
      chainId: 1952,
      url: testnetRpc,
      accounts,
    },
    xlayer: {
      chainId: 196,
      url: mainnetRpc,
      accounts,
    },
  },
};

export default config;
