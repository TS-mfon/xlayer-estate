const fs = require('fs');
const path = require('path');
const { ContractFactory, JsonRpcProvider, Wallet } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.build') });

const target = process.argv[2] || 'testnet';
const isMainnet = target === 'mainnet';
if (!['testnet', 'mainnet'].includes(target)) throw new Error('Usage: node scripts/deploy-network.js <testnet|mainnet>');
if (isMainnet && process.env.CONFIRM_MAINNET_DEPLOY !== 'YES') throw new Error('Refusing mainnet deployment. Set CONFIRM_MAINNET_DEPLOY=YES after reviewing the preflight output.');

const chainId = isMainnet ? 196 : 1952;
const rpc = isMainnet ? (process.env.XLAYER_MAINNET_RPC || 'https://rpc.xlayer.tech') : (process.env.XLAYER_TESTNET_RPC || 'https://xlayer-testnet.drpc.org');
const usdc = isMainnet ? (process.env.MAINNET_USDC_ADDRESS || process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS || '') : (process.env.USDC_ADDRESS || '0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d');
const feeCollector = isMainnet ? (process.env.MAINNET_FEE_COLLECTOR || process.env.NEXT_PUBLIC_MAINNET_FEE_COLLECTOR || process.env.FEE_COLLECTOR || '') : (process.env.FEE_COLLECTOR || '0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E');
const underwriter = process.env.UNDERWRITER_ADDRESS || '';

function artifact(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`), 'utf8'));
}
function address(name, value) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value || '') || /^0x0{40}$/.test(value)) throw new Error(`${name} is required and must be a non-zero EVM address`);
}

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY is required in .env.build');
  address('UNDERWRITER_ADDRESS', underwriter);
  address('USDC_ADDRESS', usdc);
  address('FEE_COLLECTOR', feeCollector);
  const provider = new JsonRpcProvider(rpc, { chainId, name: isMainnet ? 'xlayer' : 'xlayer-testnet' }, { staticNetwork: true });
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chainId) throw new Error(`RPC returned chain ${network.chainId}; expected ${chainId}`);
  if (isMainnet) {
    const code = await provider.getCode(usdc);
    if (code === '0x') throw new Error('Configured mainnet USDC has no deployed bytecode');
  }
  console.log(JSON.stringify({ target, chainId, rpc, deployer: wallet.address, underwriter, usdc, feeCollector }, null, 2));
  const rwa = await new ContractFactory(artifact('RWAAsset').abi, artifact('RWAAsset').bytecode, wallet).deploy(underwriter);
  await rwa.waitForDeployment();
  const rwaAddress = await rwa.getAddress();
  const marketplace = await new ContractFactory(artifact('RWAAMMMarketplace').abi, artifact('RWAAMMMarketplace').bytecode, wallet).deploy(rwaAddress, usdc, feeCollector);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  const block = await provider.getBlockNumber();
  console.log(JSON.stringify({ target, chainId, registry: rwaAddress, marketplace: marketplaceAddress, deploymentBlock: block, nextEnv: isMainnet ? { NEXT_PUBLIC_MAINNET_RWA_ADDRESS: rwaAddress, NEXT_PUBLIC_MAINNET_MARKETPLACE_ADDRESS: marketplaceAddress, NEXT_PUBLIC_MAINNET_USDC_ADDRESS: usdc, NEXT_PUBLIC_MAINNET_FEE_COLLECTOR: feeCollector, NEXT_PUBLIC_MAINNET_RWA_DEPLOYMENT_BLOCK: block, NEXT_PUBLIC_MAINNET_MARKETPLACE_DEPLOYMENT_BLOCK: block } : { NEXT_PUBLIC_RWA_ADDRESS: rwaAddress, NEXT_PUBLIC_MARKETPLACE_ADDRESS: marketplaceAddress, NEXT_PUBLIC_USDC_ADDRESS: usdc, NEXT_PUBLIC_FEE_COLLECTOR: feeCollector, NEXT_PUBLIC_RWA_DEPLOYMENT_BLOCK: block, NEXT_PUBLIC_MARKETPLACE_DEPLOYMENT_BLOCK: block } }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
