import { parseAbiItem, type Address, type PublicClient } from "viem";
import { LOG_CHUNK_SIZE, MARKETPLACE_ADDRESS, MARKETPLACE_DEPLOYMENT_BLOCK, RWA_ADDRESS, RWA_DEPLOYMENT_BLOCK } from "./config";

const assetTokenized = parseAbiItem("event AssetTokenized(uint256 indexed tokenId,address indexed owner,uint256 valuationUsd,uint256 launchValuationUsd,uint8 riskScore,bytes32 underwritingHash,bytes32 metadataHash,string metadataURI)");
const transferSingle = parseAbiItem("event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)");
const transferBatch = parseAbiItem("event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)");
const poolCreated = parseAbiItem("event PoolCreated(uint256 indexed tokenId,address indexed creator,uint256 shares,uint256 usdc,uint256 lockedLiquidity)");

async function ranges(client: PublicClient, start: bigint) {
  const end = await client.getBlockNumber();
  const values: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let fromBlock = start; fromBlock <= end; fromBlock += LOG_CHUNK_SIZE) values.push({ fromBlock, toBlock: fromBlock + LOG_CHUNK_SIZE - 1n > end ? end : fromBlock + LOG_CHUNK_SIZE - 1n });
  return values;
}

export async function discoverRegistryTokenIds(client: PublicClient) {
  const ids = new Set<bigint>();
  for (const range of await ranges(client, RWA_DEPLOYMENT_BLOCK)) {
    const logs = await client.getLogs({ address: RWA_ADDRESS, event: assetTokenized, ...range, strict: true });
    logs.forEach((log) => ids.add(log.args.tokenId));
  }
  return [...ids].sort((a, b) => Number(b - a));
}

export async function discoverMarketplaceTokenIds(client: PublicClient) {
  const ids = new Set<bigint>();
  for (const range of await ranges(client, MARKETPLACE_DEPLOYMENT_BLOCK)) {
    const logs = await client.getLogs({ address: MARKETPLACE_ADDRESS, event: poolCreated, ...range, strict: true });
    logs.forEach((log) => ids.add(log.args.tokenId));
  }
  return [...ids].sort((a, b) => Number(b - a));
}

export async function discoverWalletTokenIds(client: PublicClient, wallet: Address) {
  const ids = new Set<bigint>();
  for (const range of await ranges(client, RWA_DEPLOYMENT_BLOCK)) {
    const [originated, singlesIn, singlesOut, batchesIn, batchesOut] = await Promise.all([
      client.getLogs({ address: RWA_ADDRESS, event: assetTokenized, args: { owner: wallet }, ...range, strict: true }),
      client.getLogs({ address: RWA_ADDRESS, event: transferSingle, args: { to: wallet }, ...range, strict: true }),
      client.getLogs({ address: RWA_ADDRESS, event: transferSingle, args: { from: wallet }, ...range, strict: true }),
      client.getLogs({ address: RWA_ADDRESS, event: transferBatch, args: { to: wallet }, ...range, strict: true }),
      client.getLogs({ address: RWA_ADDRESS, event: transferBatch, args: { from: wallet }, ...range, strict: true }),
    ]);
    originated.forEach((log) => ids.add(log.args.tokenId));
    singlesIn.forEach((log) => ids.add(log.args.id)); singlesOut.forEach((log) => ids.add(log.args.id));
    batchesIn.forEach((log) => log.args.ids.forEach((id) => ids.add(id))); batchesOut.forEach((log) => log.args.ids.forEach((id) => ids.add(id)));
  }
  return [...ids].sort((a, b) => Number(b - a));
}
