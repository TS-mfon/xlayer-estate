const fs = require('fs');
require('dotenv').config({ path: '../.env.build' });
const { Wallet, JsonRpcProvider, ContractFactory } = require('ethers');

const artifact = JSON.parse(fs.readFileSync('./artifacts/contracts/RWAAsset.sol/RWAAsset.json', 'utf8'));

const CHAIN_ID = 195;
const rpc = process.env.XLAYER_TESTNET_RPC || 'https://195.rpc.thirdweb.com';
// Explicit network config so ethers never auto-detects the wrong chainId.
const provider = new JsonRpcProvider(rpc, { chainId: CHAIN_ID, name: 'xlayer-testnet' });
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

(async () => {
  console.log('deployer:', wallet.address);
  const gasPriceHex = await provider.send('eth_gasPrice', []);
  const gasPrice = BigInt(gasPriceHex);
  console.log('gasPrice (wei):', gasPrice.toString());
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log('submitting deployment (chainId', CHAIN_ID, ', legacy tx, explicit gas)...');
  // Bypass eth_estimateGas (thirdweb proxy rejects it with "invalid chain ID").
  // Use a legacy type-0 tx with explicit gasLimit + gasPrice so ethers sends
  // the raw tx via eth_sendRawTransaction directly.
  const contract = await factory.deploy({
    type: 0,
    chainId: CHAIN_ID,
    gasPrice: gasPrice,
    gasLimit: 4000000,
  });
  console.log('tx hash:', contract.deploymentTransaction().hash);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log('RWAAsset deployed to:', address);
  console.log('Set NEXT_PUBLIC_RWA_ADDRESS=' + address + ' in .env.local');
})().catch((e) => { console.error('DEPLOY FAILED:', e && e.shortMessage ? e.shortMessage : e); process.exit(1); });
