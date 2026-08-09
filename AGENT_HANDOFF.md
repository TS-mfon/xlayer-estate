# XLayer Estate — AI Real Estate Tokenization Agent (Agent Handoff)

> **Copy everything below this line into another coding agent (Cursor, Claude Code,
> Codex, Aider, etc.) to continue building/fixing this project.**

---

## What this is

A full‑stack dApp for the **X Layer BuildX AI Season Hackathon (AI‑RWA track)**.
Flow: upload a real‑estate document → an **AI agent (Google Gemini)** underwrites it
(value, risk score, flags) → it is minted as an **ERC‑1155 RWA token on X Layer**,
with an on‑chain record of valuation, risk, and a `keccak256` hash of the AI report
(for tamper‑evidence). Realistic prize target: the **50K USDT AI‑RWA Liquidity Grant**.
Submissions close **2026‑08‑21 23:59 UTC**.

## Stack

- **Frontend:** Next.js 14 (App Router, TypeScript), Tailwind, **wagmi 2.19** + **viem 2.55**, `@tanstack/react-query`.
- **Contract:** Solidity `RWAAsset` (ERC‑1155 + on‑chain asset registry), Hardhat in `deploy-agent/`.
- **AI:** Google Gemini (`gemini-2.0-flash`) with structured JSON (`responseMimeType` + `SchemaType` enum). Falls back to a deterministic **mock underwriter** when `GEMINI_API_KEY` is unset (so the app always works offline).

## CRITICAL GOTCHAS (read before touching anything)

1. **X Layer testnet chainId is 1952, NOT 195.** The thirdweb proxy
   `https://195.rpc.thirdweb.com` *lies* and reports `eth_chainId` = 195 (its URL slug),
   but its backend is chain 1952 and it accepts txs signed for 1952. Use
   `https://xlayer-testnet.drpc.org` (reports correct 1952) as the primary read RPC and
   keep thirdweb as a fallback for writes. Mainnet chainId = **196**.
   All chainId references live in `src/lib/chains.ts`, `src/lib/config.ts`,
   `src/components/AddNetworkButton.tsx`, and both `hardhat.config.ts` files.
2. **Do NOT import from `wagmi/connectors` barrel.** It statically pulls
   `@base-org/account` → `@coinbase/cdp-sdk` → optional `@x402/*` payment modules that are
   NOT installed, which breaks `next build` with `Module not found: @x402/...`.
   **Fix already applied:** import `injected` from `@wagmi/core` directly in
   `src/lib/wagmi.ts` and `src/components/WalletButton.tsx`. If you add another connector,
   import it from its deep path, never the barrel.
3. **`webpack.IgnorePlugin` does NOT fix the `@x402` issue** — it still surfaces as a
   resolver error. The deep‑import fix above is the real solution. `next.config.mjs` is
   now minimal on purpose.
4. **OpenZeppelin pinned to 4.9.5**, not 5.x. OZ 5.0.2 uses the `mcopy` opcode (Cancun‑only)
   which is risky on the zkEVM. The contract uses OZ 4.9.x syntax
   (`constructor() ERC1155("") Ownable(msg.sender) {}`).
5. **`npm run dev` is blocked by a safe‑delete guard** on `.next/`. Use
   `npm run build && npx next start -p 3000` instead.
6. **`tsconfig.json` excludes `deploy-agent`** (it's a separate Hardhat project with its
   own tsconfig; Next's type‑checker otherwise fails on `import { ethers } from "hardhat"`).
7. **`.env.build` holds the deployer PRIVATE KEY** and is gitignored. The app never reads
   it. App config is `.env.local` (`NEXT_PUBLIC_RWA_ADDRESS`, optional `GEMINI_API_KEY`,
   optional `PINATA_JWT`). Never commit either env file.

## Current state (already working)

- ✅ `npm run build` passes — 6 routes: `/`, `/tokenize`, `/dashboard`,
  `/api/underwrite`, `/api/metadata`, `/_not-found`.
- ✅ Contract **deployed** on X Layer testnet at
  `0xdba3b21c243e21ad31a59cf1dc20840871a066f1` (chainId 1952). Verified alive
  (`eth_getCode` returns bytecode; `totalAssets()` returns `0`).
- ✅ Wallet connect + **auto network switch to X Layer** implemented
  (`src/lib/useAutoNetwork.ts`, wired into `WalletButton.tsx`). When connected on a
  wrong chain it calls `wallet_switchEthereumChain`, and if the chain isn't in the
  wallet (error 4902) it calls `wallet_addEthereumChain` first. Manual
  "Switch to X Layer" button (`AddNetworkButton.tsx`) remains as fallback.
- ✅ Mock underwriter returns a full structured report (property, valuation, riskScore,
  riskFlags, summary) with no API key.
- ✅ `NEXT_PUBLIC_RWA_ADDRESS` is wired into `.env.local`.

## How to run

```bash
npm install
# for live AI: set GEMINI_API_KEY in .env.local
npm run build && npx next start -p 3000   # dev mode is guard-blocked, use start
# open http://localhost:3000
```

Deploy (needs `.env.build` with `PRIVATE_KEY` + testnet OKB):
```bash
cd deploy-agent && npm install
node deploy-raw.js          # raw ethers deploy, chainId 1952, staticNetwork:true
```

## Suggested next steps for the new agent

1. **End‑to‑end mint flow (highest priority):** the `/tokenize` page calls the AI, then
   must call `tokenizeProperty(...)` on the contract via wagmi `useWriteContract`. Verify
   the write path compiles and the ABI in `src/lib/abi.ts` matches the deployed contract
   (functions: `tokenizeProperty`, `assetInfo` (tuple!), `uri`, `setStatus`,
   `totalAssets`, `balanceOf`). Mint a test asset from a real wallet and confirm it shows
   on `/dashboard`.
2. **Metadata pinning:** `src/app/api/metadata/route.ts` should pin the report JSON to
   IPFS (Pinata via `PINATA_JWT`, currently optional/no‑op). Wire the returned IPFS URI
   into `tokenizeProperty`'s `metadataURI`.
3. **Report hash on‑chain:** pass `keccak256(reportJson)` (helper in `src/lib/metadata.ts`)
   as `underwritingHash` so the token is verifiable.
4. **UX polish:** loading/error states on underwriting + mint; tx toast; "view on OKLink"
   links using `EXPLORERS[1952]` in `src/lib/config.ts`.
5. **Tests:** add a unit test for the mock underwriter and an on‑chain test (Hardhat /
   Foundry) for `tokenizeProperty` + `assetInfo`.
6. **Mainnet path:** add a mainnet deploy + a chain toggle once the hackathon MVP is solid.
7. **Submission assets:** demo video, README screenshots, hackathon form answers.

## Key files

```
contracts/RWAAsset.sol          ERC-1155 + asset registry (OZ 4.9.5)
deploy-agent/                   clean Hardhat/ethers deploy dir (chainId 1952)
src/lib/chains.ts               X Layer testnet(1952) + mainnet(196), RPC ordering
src/lib/wagmi.ts                wagmi config (injected from @wagmi/core)
src/lib/abi.ts                  contract ABI (assetInfo is a tuple)
src/lib/useAutoNetwork.ts       auto-switch wallet to X Layer
src/lib/{gemini,metadata,config,format,types}.ts
src/app/tokenize                upload → AI underwriting → mint
src/app/dashboard               on-chain asset explorer
src/app/api/underwrite          Gemini JSON extraction + mock fallback
src/app/api/metadata            pins report JSON (IPFS, optional)
src/components/{WalletButton,AddNetworkButton,Nav,AssetCard}.tsx
```

## One‑line context for the agent

"Continue building XLayer Estate: a Next.js + wagmi + viem dApp that uses Google Gemini
to underwrite real‑estate docs and mints them as ERC‑1155 RWA tokens on X Layer testnet
(chainId 1952; deployed contract 0xdba3b21c243e21ad31a59cf1dc20840871a066f1). The build
passes and the AI/mock + wallet + auto‑network‑switch work. Finish the on‑chain mint
write path, IPFS metadata pinning, and UX polish. NEVER import wagmi/connectors barrel;
import injected from @wagmi/core. Keep OZ at 4.9.5."
