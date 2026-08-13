# XLayer Estate

**Privacy-first AI tokenization for physical assets on X Layer.**

## Protocol documentation

- [Protocol specification](docs/PROTOCOL.md)
- [System architecture](docs/ARCHITECTURE.md)
- [Security and risk model](docs/SECURITY.md)
- [Integration guide](docs/INTEGRATION.md)
- [Deployment and operations](docs/OPERATIONS.md)
- [Cinematic interface specification](DESIGN_PROMPT.md)

XLayer Estate lets a user upload a clear photo or a supporting record for a
physical item—such as a laptop, phone, camera, watch, cup, furniture, vehicle,
collectible, tool, appliance, or piece of equipment. Gemini identifies the
asset, estimates conservative second-hand value, flags obvious risk, and
returns a structured report. An approved report receives a server-side EIP-712
authorization and can be minted as an image-bearing ERC-1155 token on X Layer
testnet.

The token represents **fractional exposure to a self-attested asset record**.
It does not prove legal ownership, transfer title, custody, authenticity, or a
claim against the physical item. This is a testnet software demonstration, not
an investment product, custody service, appraisal, legal opinion, or offer to
sell securities.

## Product flow

1. **Upload** — submit an asset photo or optional supporting document.
2. **AI gate** — Gemini checks that the upload shows a recognizable, lawful,
   tangible asset. It does not require private receipts, identity documents,
   addresses, deeds, or ownership paperwork.
3. **Underwrite** — Gemini returns an asset category, visible brand/model,
   condition, conservative resale valuation range, confidence, and risk flags.
4. **Authorize** — the server signs a short-lived EIP-712 mint authorization.
   The browser cannot invent a report or bypass the underwriter.
5. **Mint** — the connected wallet mints one million ERC-1155 shares. Metadata
   includes the uploaded/generated image and a keccak256 report hash.
6. **List** — the issuer approves the marketplace, supplies matching shares and
   at least 10 USDC_TEST, and pays the fixed listing fee.
7. **Trade** — buyers and sellers swap fractional shares against USDC_TEST in a
   constant-product AMM with slippage and deadline protection.

## What can be uploaded?

The preferred input is a clear photo of a physical item. Examples:

- laptop, phone, tablet, monitor, camera, lens, headphones, or game console;
- watch, jewellery, fashion item, furniture, appliance, tool, or equipment;
- bicycle, vehicle, machine, collectible, instrument, artwork, or other lawful
  tangible goods;
- a non-confidential receipt, public listing, serial-number record, appraisal,
  or product record as additional evidence.

The system may reject people, animals, food, services, ideas, financial
instruments, illegal goods, weapons, blank files, screenshots without a visible
asset, unrecognizable images, manipulated evidence, and contradictory records.
Ownership is always displayed as **self-attested / not verified**.

Low-value objects are supported. If an asset is worth less than the mandatory
10 USDC launch seed, the pool uses the full one-million-share supply and the
market effectively launches at the protocol's 10 USDC market floor. This does
not increase the AI valuation or claim that the item is worth 10 USDC.

## Privacy model

- Do not upload passports, private keys, seed phrases, bank statements, full
  addresses, or confidential contracts.
- A photo is enough for a first-pass demo; receipts and ownership documents are
  optional evidence, not mandatory inputs.
- Gemini receives the uploaded file when `GEMINI_API_KEY` is configured.
- The server stores no local files. If `PINATA_JWT` is configured, metadata and
  images are pinned to IPFS; otherwise the API returns content-addressed data
  URIs for the demo.
- The report hash is stored on-chain, not the raw report contents.
- IPFS is public by design. Never pin confidential material.
- The application does not verify legal ownership or physical custody.

## Marketplace and fees

The quote asset is `USDC_TEST` with six decimals. OKB is not used for trading,
which avoids oracle and quote-asset complexity.

### Initial listing

- The issuer must provide at least `10.00 USDC_TEST` to the pool.
- The issuer also supplies the matching ERC-1155 shares.
- The first 10 USDC worth of LP liquidity is permanently locked.
- A separate fixed `0.20 USDC_TEST` listing fee is transferred to the fee
  collector. It is not removed from the pool seed.

### Buy

- The buyer enters a total USDC amount including the `0.20 USDC_TEST` platform
  fee.
- The fixed fee is sent to the collector.
- The remainder enters the AMM and is subject to the 0.30% liquidity-provider
  swap fee.
- Quotes include the fixed fee and show expected shares after the fee.

### Sell

- The seller supplies ERC-1155 shares.
- The AMM computes gross USDC proceeds, then deducts the fixed `0.20 USDC_TEST`
  platform fee.
- The seller receives net proceeds; the fixed fee goes to the collector.
- Very small trades that cannot cover the fixed fee revert rather than creating
  an ambiguous negative payout.

### Fee collector

The configured collector is:

```text
0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E
```

The deployed marketplace stores this address immutably. Users can verify fee
transfers through the `PlatformFeePaid` event and token transfer logs.

## Smart contracts

### `RWAAsset.sol`

An ERC-1155 registry with one token ID per approved physical asset. Each asset
stores:

- AI valuation and conservative launch valuation;
- risk score and lifecycle status;
- underwriting report hash and metadata hash;
- image-bearing metadata URI;
- issuer wallet and creation timestamp.

Minting requires a valid EIP-712 signature from the configured underwriter.
Authorization digests are one-time use and have deadlines.

The legacy Solidity function name `tokenizeProperty` is retained for deployed
contract compatibility; it now accepts generic physical-asset reports.

### `RWAAMMMarketplace.sol`

The marketplace holds ERC-1155 shares and USDC_TEST reserves. It implements:

- issuer-only market creation;
- minimum 10 USDC seed;
- permanent minimum-liquidity lock;
- add/remove liquidity with slippage checks;
- constant-product buy and sell quotes;
- fixed platform fee transfers;
- 0.30% LP swap fee;
- asset-status checks, pause controls, reentrancy protection, and deadline
  protection.

## Technology

- Next.js 14 App Router, TypeScript, Tailwind CSS.
- wagmi 2.19, viem 2.55, TanStack Query.
- Framer Motion, Three.js, React Three Fiber, GSAP ScrollTrigger.
- Solidity 0.8.24 and OpenZeppelin 4.9.5.
- Hardhat contract tests.
- Google Gemini structured JSON underwriting with a safe manual-review fallback.

## X Layer network details

| Network | Chain ID | RPC | Explorer |
|---|---:|---|---|
| X Layer testnet | `1952` | `https://xlayer-testnet.drpc.org` | OKLink X Layer test |
| X Layer mainnet | `196` | `https://rpc.xlayer.tech` | OKLink X Layer |

Do not use `195` as the chain ID. The thirdweb URL `195.rpc.thirdweb.com` uses
195 in its slug but its backend is the X Layer testnet environment. The app
uses chain ID `1952` for wallet signatures and reads.

## Current testnet addresses

Addresses are deployment-specific. The production environment should always be
checked before sending a transaction.

```text
RWA registry:       0xc90197fBAe660e0f4b091b4f5E0215fEE0336A67
USDC_TEST:          0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d
Fee collector:      0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E
Marketplace V3:     0x84e6C8412D48b9d8469705d56541C5Fd39b18f36
```

## Local setup

Requirements: Node.js 20+, npm, a browser wallet, and testnet OKB for gas.

```bash
npm install
cp .env.example .env.local
npm run build
npx next start -p 3000
```

Open `http://localhost:3000`.

The repository intentionally uses `npm run build && npx next start` for the
stable local demo path. If `.next` exists and the safe-delete guard blocks
`npm run dev`, do not delete unrelated files; use the production start command.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`, `.env.build`,
private keys, Gemini keys, Pinata JWTs, or session secrets.

### Browser-visible

- `NEXT_PUBLIC_RWA_ADDRESS` — deployed registry address.
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS` — deployed fee-aware marketplace.
- `NEXT_PUBLIC_USDC_ADDRESS` — six-decimal USDC_TEST address.
- `NEXT_PUBLIC_FEE_COLLECTOR` — display-only collector address.

### Server-only

- `GEMINI_API_KEY` — enables live image/document analysis.
- `PINATA_JWT` — optional IPFS pinning credential.
- `UNDERWRITER_PRIVATE_KEY` — server-only signing key; never use the deployer
  key here.
- `UNDERWRITER_SESSION_SECRET` — HMAC secret for evaluation sessions.

## Deploy contracts

Keep deployment credentials in `.env.build`, which is gitignored:

```bash
PRIVATE_KEY=...
UNDERWRITER_ADDRESS=...
UNDERWRITER_PRIVATE_KEY=...
UNDERWRITER_SESSION_SECRET=...
XLAYER_TESTNET_RPC=https://xlayer-testnet.drpc.org
USDC_ADDRESS=0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d
FEE_COLLECTOR=0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E
```

Compile and deploy:

```bash
npm run compile
npm run deploy:v2
```

The script deploys a new registry and marketplace. For the current migration,
the existing registry can remain in place and only the marketplace needs to be
replaced, provided the registry's ERC-1155 asset contract is unchanged.

After deployment, copy the printed addresses into `.env.local` and Vercel:

```bash
NEXT_PUBLIC_RWA_ADDRESS=...
NEXT_PUBLIC_MARKETPLACE_ADDRESS=...
NEXT_PUBLIC_USDC_ADDRESS=0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d
NEXT_PUBLIC_FEE_COLLECTOR=0x5905c9Dea6Ae52AA0947D8F7F218263889eDfC4E
```

## Test suite

```bash
npx tsc --noEmit --pretty false
npm run compile
npm run test:contract
git diff --check
```

The Hardhat suite covers signed minting, replay protection, invalid signatures,
valuation-anchored liquidity, locked minimum liquidity, buy/sell settlement,
non-issuer rejection, fee collection, minimum trade size, and low-value asset
markets.

## User testing checklist

1. Use a public or personal photo of a laptop, cup, camera, watch, or other
   lawful physical item. Do not upload confidential documents.
2. Upload the image on `/tokenize`.
3. Confirm the AI report identifies the item and shows a non-zero conservative
   resale valuation.
4. Connect the deployer/test wallet on X Layer testnet.
5. Mint the ERC-1155 asset and open its marketplace page.
6. Approve shares and USDC_TEST.
7. Enter at least `10` USDC for listing plus the separate `0.20` USDC fee.
8. Use a second test wallet for buy/sell testing; never use a production wallet
   or real funds.

## Limitations and safety

- AI valuation is an estimate, not a professional appraisal.
- A token does not transfer ownership of the physical item.
- The platform does not custody, inspect, insure, store, ship, or authenticate
  physical goods.
- Self-attested asset records can be fraudulent; AI checks reduce risk but do
  not eliminate fraud.
- USDC_TEST is faucet/test currency and has no implied real-world value.
- The protocol is deployed for testnet experimentation and has not received a
  legal, security, financial, or regulatory audit.
- Do not use the system to tokenize prohibited goods, sensitive personal data,
  or assets you do not have permission to describe.

## Project layout

```text
contracts/RWAAsset.sol             ERC-1155 asset registry and signed minting
contracts/RWAAMMMarketplace.sol    USDC AMM, liquidity lock, and platform fees
src/app/api/underwrite             Gemini tangible-asset gate and valuation
src/app/api/metadata               image/metadata preparation and EIP-712 signing
src/app/tokenize                    upload → evaluate → mint flow
src/app/marketplace                 market discovery and trading UI
src/components/CinematicHome.tsx   cinematic landing experience
src/lib/attestation.ts              report hashing and mint authorization
src/lib/abi.ts                      frontend contract interfaces
test/RWAAsset.test.js               registry and marketplace tests
```
