const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.build') });
const { Wallet, JsonRpcProvider, getCreateAddress } = require('ethers');

const artifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/contracts/RWAAsset.sol/RWAAsset.json'), 'utf8'));
const CHAIN_ID = 1952; // X Layer testnet true EVM chainId (thirdweb proxy misreports 195)
const rpc = process.env.XLAYER_TESTNET_RPC || 'https://xlayer-testnet.drpc.org';
// staticNetwork:true -> ethers won't abort on the proxy's lying eth_chainId (195).
const provider = new JsonRpcProvider(rpc, { chainId: CHAIN_ID, name: 'xlayer-testnet' }, { staticNetwork: true });
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
const toHex = (v) => '0x' + BigInt(v).toString(16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('deployer:', wallet.address);
  const nonce = BigInt(await provider.send('eth_getTransactionCount', [wallet.address, 'latest']));
  const expectedAddr = getCreateAddress({ from: wallet.address, nonce: Number(nonce) });
  console.log('nonce:', nonce.toString(), '=> expected contract:', expectedAddr);

  const prioHex = await provider.send('eth_maxPriorityFeePerGas', []);
  const blockHex = await provider.send('eth_getBlockByNumber', ['latest', false]);
  const maxPriorityFeePerGas = BigInt(prioHex);
  const baseFee = BigInt(blockHex.baseFeePerGas || '0x0');
  const maxFeePerGas = baseFee * 3n + maxPriorityFeePerGas;
  console.log('maxPriority:', maxPriorityFeePerGas.toString(), 'maxFee:', maxFeePerGas.toString());

  const tx = {
    type: 2, chainId: CHAIN_ID, nonce: toHex(nonce),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas), maxFeePerGas: toHex(maxFeePerGas),
    gasLimit: '0x3d0900', to: null, value: '0x0',
    data: artifact.bytecode, accessList: [],
  };
  const signed = await wallet.signTransaction(tx);

  let txHash;
  try {
    txHash = await provider.send('eth_sendRawTransaction', [signed]);
    console.log('SUBMITTED tx hash:', txHash);
  } catch (e) {
    const msg = (e.error && e.error.message) || e.shortMessage || String(e);
    console.log('sendRawTransaction issue:', msg);
    // If already mined (nonce too low), the contract is at expectedAddr for nonce-1.
    if (/nonce/i.test(msg)) {
      const prev = getCreateAddress({ from: wallet.address, nonce: Number(nonce) - 1 });
      console.log('Likely already deployed at:', prev);
      process.exit(0);
    }
    process.exit(1);
  }

  // Manual receipt polling (no waitForTransaction -> no network-change abort).
  let receipt = null;
  for (let i = 0; i < 90; i++) {
    receipt = await provider.send('eth_getTransactionReceipt', [txHash]);
    if (receipt) break;
    await sleep(2000);
  }
  if (!receipt) { console.error('No receipt after polling; tx hash:', txHash); process.exit(2); }
  const status = Number(receipt.status);
  const contractAddr = receipt.contractAddress || expectedAddr;
  console.log('receipt status:', status, 'contractAddress:', contractAddr);
  if (status === 1) {
    console.log('DEPLOY OK');
    console.log('NEXT_PUBLIC_RWA_ADDRESS=' + contractAddr);
  } else {
    console.error('TX REVERTED');
    process.exit(1);
  }
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
