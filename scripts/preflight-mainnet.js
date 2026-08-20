const fs = require('fs');
const path = require('path');
const { JsonRpcProvider, Wallet, Contract } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.build') });

const RPC = process.env.XLAYER_MAINNET_RPC || 'https://rpc.xlayer.tech';
const USDC = process.env.MAINNET_USDC_ADDRESS || process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS || '';
const FEE_COLLECTOR = process.env.MAINNET_FEE_COLLECTOR || process.env.NEXT_PUBLIC_MAINNET_FEE_COLLECTOR || process.env.FEE_COLLECTOR || '';
const ZERO = /^0x0{40}$/;

function required(name, value) {
  if (!value || ZERO.test(value)) throw new Error(`${name} is required and must be non-zero`);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`${name} is not a valid EVM address`);
}

function requiredSecret(name, value) {
  if (!value) throw new Error(`${name} is required`);
}

async function main() {
  requiredSecret('PRIVATE_KEY', process.env.PRIVATE_KEY);
  required('UNDERWRITER_ADDRESS', process.env.UNDERWRITER_ADDRESS);
  required('MAINNET_USDC_ADDRESS', USDC);
  required('FEE_COLLECTOR', FEE_COLLECTOR);

  const provider = new JsonRpcProvider(RPC, { chainId: 196, name: 'xlayer' }, { staticNetwork: true });
  const [network, wallet] = await Promise.all([provider.getNetwork(), Promise.resolve(new Wallet(process.env.PRIVATE_KEY, provider))]);
  if (Number(network.chainId) !== 196) throw new Error(`RPC returned chain ${network.chainId}; refusing mainnet deployment`);

  const [code, balance, usdcCode] = await Promise.all([
    provider.getCode(USDC),
    provider.getBalance(wallet.address),
    provider.getCode(USDC),
  ]);
  if (usdcCode === '0x' || code === '0x') throw new Error(`USDC address ${USDC} has no deployed bytecode on X Layer mainnet`);

  const usdc = new Contract(USDC, [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
  ], provider);
  const [decimals, symbol] = await Promise.all([usdc.decimals(), usdc.symbol()]);
  if (Number(decimals) !== 6 || String(symbol).toUpperCase() !== 'USDC') {
    throw new Error(`Configured mainnet settlement token is ${symbol} with ${decimals} decimals; expected USDC with 6 decimals`);
  }

  const artifacts = [
    'artifacts/contracts/RWAAsset.sol/RWAAsset.json',
    'artifacts/contracts/RWAAMMMarketplace.sol/RWAAMMMarketplace.json',
  ];
  for (const file of artifacts) {
    if (!fs.existsSync(path.resolve(__dirname, '..', file))) throw new Error(`Missing compiled artifact: ${file}. Run npm run compile first`);
  }

  console.log(JSON.stringify({
    ok: true,
    chainId: Number(network.chainId),
    rpc: RPC,
    deployer: wallet.address,
    underwriter: process.env.UNDERWRITER_ADDRESS,
    feeCollector: FEE_COLLECTOR,
    usdc: { address: USDC, symbol, decimals: Number(decimals) },
    deployerOkbWei: balance.toString(),
    note: 'Preflight passed. No transaction was broadcast.',
  }, null, 2));
}

main().catch((error) => {
  console.error(`MAINNET PREFLIGHT FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
