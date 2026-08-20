import { xlayer, xlayerTestnet } from "./chains";

export type SupportedChainId = 1952 | 196;

export type NetworkConfig = {
  id: SupportedChainId;
  key: "testnet" | "mainnet";
  label: string;
  shortLabel: string;
  chain: typeof xlayerTestnet | typeof xlayer;
  registry: `0x${string}`;
  marketplace: `0x${string}`;
  usdc: `0x${string}`;
  feeCollector: `0x${string}`;
  registryDeploymentBlock: bigint;
  marketplaceDeploymentBlock: bigint;
  isTestnet: boolean;
  settlementLabel: string;
  configured: boolean;
};

const zeroAddress = "0x0000000000000000000000000000000000000000" as const;
const env = (name: string, fallback = "") => process.env[name] ?? fallback;
const address = (name: string, fallback: string = zeroAddress) => (env(name, fallback) || fallback) as `0x${string}`;
const block = (name: string, fallback: string) => BigInt(env(name, fallback));

export const NETWORKS: Record<SupportedChainId, NetworkConfig> = {
  1952: {
    id: 1952,
    key: "testnet",
    label: "X Layer Testnet",
    shortLabel: "Testnet",
    chain: xlayerTestnet,
    registry: address("NEXT_PUBLIC_RWA_ADDRESS", "0xc90197fBAe660e0f4b091b4f5E0215fEE0336A67"),
    marketplace: address("NEXT_PUBLIC_MARKETPLACE_ADDRESS", "0x84e6C8412D48b9d8469705d56541C5Fd39b18f36"),
    usdc: address("NEXT_PUBLIC_USDC_ADDRESS", "0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d"),
    feeCollector: address("NEXT_PUBLIC_FEE_COLLECTOR", "0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E"),
    registryDeploymentBlock: block("NEXT_PUBLIC_RWA_DEPLOYMENT_BLOCK", "38100000"),
    marketplaceDeploymentBlock: block("NEXT_PUBLIC_MARKETPLACE_DEPLOYMENT_BLOCK", "38100000"),
    isTestnet: true,
    settlementLabel: "USDC_TEST",
    configured: true,
  },
  196: {
    id: 196,
    key: "mainnet",
    label: "X Layer Mainnet",
    shortLabel: "Mainnet",
    chain: xlayer,
    registry: address("NEXT_PUBLIC_MAINNET_RWA_ADDRESS"),
    marketplace: address("NEXT_PUBLIC_MAINNET_MARKETPLACE_ADDRESS"),
    usdc: address("NEXT_PUBLIC_MAINNET_USDC_ADDRESS"),
    feeCollector: address("NEXT_PUBLIC_MAINNET_FEE_COLLECTOR", env("NEXT_PUBLIC_FEE_COLLECTOR", zeroAddress)),
    registryDeploymentBlock: block("NEXT_PUBLIC_MAINNET_RWA_DEPLOYMENT_BLOCK", "0"),
    marketplaceDeploymentBlock: block("NEXT_PUBLIC_MAINNET_MARKETPLACE_DEPLOYMENT_BLOCK", "0"),
    isTestnet: false,
    settlementLabel: "USDC",
    configured: false,
  },
};

export const DEFAULT_CHAIN_ID: SupportedChainId = 1952;

export function isSupportedChainId(value: number): value is SupportedChainId {
  return value === 1952 || value === 196;
}

export function isNetworkConfigured(chainId: SupportedChainId) {
  const network = NETWORKS[chainId];
  return network.registry !== zeroAddress && network.marketplace !== zeroAddress && network.usdc !== zeroAddress;
}

export function getNetwork(chainId: number | string | undefined | null): NetworkConfig {
  const numeric = Number(chainId ?? DEFAULT_CHAIN_ID);
  return NETWORKS[isSupportedChainId(numeric) ? numeric : DEFAULT_CHAIN_ID];
}

export function configuredNetwork(chainId: number | string | undefined | null): NetworkConfig {
  const network = getNetwork(chainId);
  if (network.registry === zeroAddress || network.marketplace === zeroAddress || network.usdc === zeroAddress) {
    throw new Error("X Layer mainnet is not configured yet. Select testnet or configure the mainnet contracts.");
  }
  return network;
}
