require('dotenv').config({ path: '../.env.build' });
const { Wallet, JsonRpcProvider, formatEther } = require('ethers');

const key = process.env.PRIVATE_KEY;
const rpc = process.env.XLAYER_TESTNET_RPC || 'https://195.rpc.thirdweb.com';
const w = new Wallet(key);
const p = new JsonRpcProvider(rpc);

(async () => {
  const bal = await p.getBalance(w.address);
  console.log('deployer address:', w.address);
  console.log('balance (wei):', bal.toString());
  console.log('balance (OKB):', formatEther(bal));
  console.log(bal > 0n ? 'HAS FUNDS — ready to deploy' : 'NO FUNDS — need testnet faucet');
})().catch((e) => { console.error(e); process.exit(1); });
