const { Wallet, JsonRpcProvider } = require('ethers');
require('dotenv').config({ path: '../.env.build' });
const rpc = process.env.XLAYER_TESTNET_RPC || 'https://195.rpc.thirdweb.com';
const wallet = new Wallet(process.env.PRIVATE_KEY);
const toHex = (v) => '0x' + BigInt(v).toString(16);
const cands = [1952, 1950, 1951, 1953, 1954, 1955, 195, 196, 1442];
(async () => {
  for (const cid of cands) {
    const provider = new JsonRpcProvider(rpc, { chainId: cid, name: 'p' });
    const w = wallet.connect(provider);
    try {
      const nonceHex = await provider.send('eth_getTransactionCount', [w.address, 'latest']);
      const prioHex = await provider.send('eth_maxPriorityFeePerGas', []);
      const blockHex = await provider.send('eth_getBlockByNumber', ['latest', false]);
      const nonce = BigInt(nonceHex);
      const maxPriorityFeePerGas = BigInt(prioHex);
      const baseFee = BigInt(blockHex.baseFeePerGas || '0x0');
      const maxFeePerGas = baseFee * 3n + maxPriorityFeePerGas;
      const tx = { type: 2, chainId: cid, nonce: toHex(nonce), maxPriorityFeePerGas: toHex(maxPriorityFeePerGas), maxFeePerGas: toHex(maxFeePerGas), gasLimit: '0x5208', to: w.address, value: '0x0', data: '0x', accessList: [] };
      const signed = await w.signTransaction(tx);
      const txHash = await provider.send('eth_sendRawTransaction', [signed]);
      console.log('CHAINID', cid, '=> ACCEPTED:', txHash);
      process.exit(0);
    } catch (e) {
      console.log('CHAINID', cid, '=>', (e.error && e.error.message) || e.shortMessage || e.message);
    }
  }
  console.log('NONE');
})();
