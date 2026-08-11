# XLayer Estate — AI Real Estate Tokenization Agent

Built for the **X Layer BuildX AI Season Hackathon** (AI-RWA track).

Upload a real-estate document → an **AI agent (Google Gemini)** underwrites it
(value, risk score, flags) → mint it as an **ERC-1155 RWA token on X Layer**,
with an on-chain record of valuation, risk, and a tamper-proof report hash.

The redesigned interface uses a cinematic WebGL layer and one scrubbed GSAP
ScrollTrigger timeline to assemble the product story: document ingestion → AI
underwriting → report fingerprint → ERC-1155 tokenization.

## Why this fits the AI-RWA track
- **Real AI**: document understanding + valuation + risk scoring via Gemini.
- **Real on-chain primitive**: ERC-1155 RWA tokens on X Layer (EVM zkEVM L2).
- **Verifiable provenance**: each token stores a `keccak256` hash of the AI
  underwriting report, so anyone can verify the asset was tokenized from a
  specific AI analysis.

## Tech stack
- **Frontend**: Next.js 14 (App Router, TypeScript), Tailwind, wagmi + viem,
  React Three Fiber, Drei, Three.js, and GSAP ScrollTrigger.
- **Smart contract**: Solidity `RWAAsset` (ERC-1155 + asset registry), Hardhat.
- **AI**: Google Gemini (`gemini-2.5-flash`) with structured JSON output; falls
  back to a built-in mock underwriter when no API key is set.

## Prerequisites
- Node.js 20+
- A wallet (OKX Wallet / MetaWallet / MetaMask). For deployment you need a
  **throwaway** private key funded with testnet OKB.
- (Optional) `GEMINI_API_KEY` for live AI analysis. The legacy
  `GERMINI_APIKEY` name is also recognized.

## Setup
```bash
npm install

# Frontend env
cp .env.example .env.local
#   - set NEXT_PUBLIC_RWA_ADDRESS after deploy
#   - (optional) set GEMINI_API_KEY

# Deploy env (kept separate from the app)
cp .env.build .env.build   # edit and paste your testnet PRIVATE_KEY
```

## Deploy to X Layer Testnet (chain 1952)
1. Get testnet OKB from the faucet: https://thirdweb.com/x-layer-testnet
   (0.01 OKB/day). Paste your deployer private key into `.env.build`.
2. Compile & deploy:
   ```bash
   npm run compile
   npm run deploy:testnet
   ```
3. Copy the printed contract address into `.env.local` as `NEXT_PUBLIC_RWA_ADDRESS`.
4. Run the app:
   ```bash
   npm run build && npx next start -p 3000
   ```
   Open http://localhost:3000

> **Heads-up on chainId**: X Layer testnet's *true* EVM chainId is **1952**.
> The thirdweb proxy `https://195.rpc.thirdweb.com` misreports `eth_chainId` as
> `195` (the URL slug), but its backend node is chain 1952 and it accepts txs
> signed for `chainId: 1952`. We use `https://xlayer-testnet.drpc.org` (which
> reports the correct 1952) as the primary read endpoint and keep thirdweb as a
> fallback. Mainnet chainId is `196`.

## Demo script (for judges)
1. Connect wallet → click **Switch to X Layer Testnet** if prompted.
2. Go to **Tokenize**, drop a property PDF / image / text.
3. The AI agent returns a structured underwriting report (value, risk gauge, flags).
4. Click **Mint RWA token** → confirm in wallet → token is minted on X Layer.
5. Open **Dashboard** to see all tokenized assets with on-chain data + report links.
6. (Optional) set `GEMINI_API_KEY` to replace the mock underwriter with live Gemini.

Contract validation:

```bash
npm run test:contract
```

## Project layout
```
contracts/RWAAsset.sol        ERC-1155 + on-chain asset registry
hardhat/deploy/00_deploy.ts   X Layer testnet deploy script
src/app/tokenize              upload → AI underwriting → mint flow
src/app/dashboard             on-chain asset explorer
src/app/api/underwrite        Gemini JSON extraction + mock fallback
src/app/api/metadata          pins report JSON, returns hash + uri
src/lib                      chains, wagmi, abi, gemini client, helpers
```

## Notes
- Without `GEMINI_API_KEY` the app runs fully on a deterministic **mock underwriter**
  so the demo always works offline.
- Set `PINATA_JWT` to pin reports to IPFS. Without it, metadata uses an explicit
  content-addressed data URI fallback rather than Vercel's ephemeral filesystem.
- The `200K Launch Grant` (OKX DEX volume) is out of MVP scope (needs a live
  secondary market) and tracked as future work. The realistic target is the
  **50K USDT AI-RWA Liquidity Grant**.
- `NEXT_PUBLIC_RWA_ADDRESS` and `.env.build` (with the private key) are gitignored.
