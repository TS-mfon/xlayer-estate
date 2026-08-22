# XLayer Estate

**Privacy-first AI tokenization for physical assets on X Layer.**

XLayer Estate is an AI-gated issuance and liquidity protocol for self-attested
physical assets. It converts original visual evidence into a structured,
tamper-evident asset record; authorizes ERC-1155 issuance through a short-lived
EIP-712 underwriting signature; and lets an issuer open a valuation-anchored
fractional market on X Layer.

The current production deployment is V1 testnet. V2 contracts compile and pass
the local adversarial suite, but V2 addresses are not presented as live until a
dedicated testnet rollout and verification are complete.

The V2 architecture adds versioned Evidence and Asset Passport registries,
deterministic policy enforcement, a bounded agent gateway, and isolated markets
with reserve-depth and price-impact controls. V2 is additive beside the current
V1 deployment; existing V1 assets remain readable during migration.

> **Protocol status:** X Layer testnet is operational. Mainnet support exists in
> the application and deployment tooling, but must remain disabled until fresh
> chain-196 contracts, a verified six-decimal settlement token, explorer source
> verification, and production key management are in place.

## Contents

- [Protocol documentation](#protocol-documentation)
- [Protocol at a glance](#protocol-at-a-glance)
- [AI RWE track justification](#ai-rwe-track-justification)
- [Architecture and trust boundaries](#architecture-and-trust-boundaries)
- [Network and deployment status](#dual-network-status)
- [Asset lifecycle](#product-flow)
- [Evidence policy and privacy](#what-can-be-uploaded)
- [Marketplace economics](#marketplace-and-fees)
- [Smart-contract interfaces](#smart-contracts)
- [Indexer and persistence](#durable-indexing-and-live-prices)
- [Local development](#local-setup)
- [Deployment operations](#deploy-contracts)
- [Testing and release gates](#test-suite)
- [Security, limitations, and incident response](#limitations-and-safety)
- [Repository structure](#project-layout)

## Protocol documentation

- [Protocol specification](docs/PROTOCOL.md)
- [System architecture](docs/ARCHITECTURE.md)
- [Security and risk model](docs/SECURITY.md)
- [Integration guide](docs/INTEGRATION.md)
- [Deployment and operations](docs/OPERATIONS.md)
- [V2 protocol specification](docs/V2_PROTOCOL.md)
- [Cinematic interface specification](DESIGN_PROMPT.md)
- [In-app documentation portal](https://xlayer-estate.vercel.app/docs)
- [V2 protocol specification](docs/V2_PROTOCOL.md)

The root README is the protocol entrypoint. The files in `docs/` provide deeper
normative specifications, integration sequences, security assumptions, and
operator runbooks. The deployed application also exposes the same concepts
through the searchable, user-and-developer-facing `/docs` portal.

## Protocol at a glance

| Property | Current implementation |
| --- | --- |
| Issuance standard | ERC-1155, one token ID per approved asset |
| Initial supply | `1,000,000` fractional units per asset |
| AI control point | Gemini evidence analysis, classification, condition, valuation, risk, and mint eligibility |
| Authorization | Chain-bound EIP-712 signature from the configured underwriter |
| Tamper evidence | `keccak256` report hash and metadata hash stored in the registry |
| Exchange | Per-asset constant-product AMM |
| Testnet settlement | Project `MockUSDC` named `USDC_TEST`, six decimals |
| Minimum initial liquidity | `10.00 USDC_TEST` plus a separate `0.20 USDC_TEST` listing fee |
| Trading fee model | `0.30%` LP fee plus fixed `0.20` settlement-token platform fee per buy or sell |
| Persistence | X Layer contracts are authoritative; Neon is an optional durable read model |
| Media | Commit-pinned public demo repository or an inline data-URI fallback |
| Custody | Non-custodial for wallets; no physical-asset custody or redemption |
| Ownership assertion | Self-attested and explicitly not legally verified |

### Design principles

1. **AI must control issuance, not decorate it.** A mint cannot be created from
   browser-supplied fields alone; it requires a valid server-issued signature
   over the normalized underwriting result.
2. **Contracts remain authoritative.** Neon, GitHub media, Gemini, and RPC
   providers improve usability or availability but cannot create balances,
   pools, or accepted mint records.
3. **Evidence should be useful without being invasive.** The default workflow
   asks for an original physical-asset photo, not identity records, deeds, bank
   statements, or confidential contracts.
4. **Every economic transition is inspectable.** Mint hashes, asset status,
   reserves, liquidity, fees, trades, and ownership balances are readable from
   X Layer.
5. **Failure should degrade safely.** Invalid evidence cannot mint; failed image
   generation falls back to sanitized media; indexer failure falls back to
   direct chain reads; unconfigured mainnet remains unavailable.

## Architecture and trust boundaries

```text
┌──────────────────────────────────────────────────────────────────────┐
│ User + browser wallet                                                │
│ upload evidence · review report · sign transactions · hold shares    │
└───────────────┬───────────────────────────────────────┬──────────────┘
                │ HTTPS                                 │ wallet RPC
                ▼                                       ▼
┌──────────────────────────────────────┐   ┌───────────────────────────┐
│ Next.js protocol services            │   │ X Layer                   │
│                                      │   │                           │
│ /api/underwrite                      │   │ RWAAsset                  │
│  ├─ Gemini structured inference      │   │  ├─ ERC-1155 balances     │
│  ├─ deterministic policy thresholds  │   │  ├─ asset registry        │
│  └─ report-bound evaluation token    │   │  └─ EIP-712 mint gate     │
│                                      │   │                           │
│ /api/generate-image                  │   │ RWAAMMMarketplace         │
│  ├─ Gemini asset twin                │   │  ├─ pool reserves         │
│  ├─ sanitized photo fallback         │   │  ├─ LP accounting         │
│  └─ deterministic illustration       │   │  ├─ buy / sell settlement │
│                                      │   │  └─ platform fees         │
│ /api/metadata                        │   └─────────────┬─────────────┘
│  ├─ canonical hashes                 │                 │ events/reads
│  ├─ media + metadata persistence     │                 ▼
│  └─ EIP-712 underwriter signature    │   ┌───────────────────────────┐
└───────────────┬──────────────────────┘   │ Read infrastructure       │
                │                          │ direct RPC + optional Neon│
                ▼                          └───────────────────────────┘
        Gemini + demo media store
```

### Trust matrix

| Component | Trusted for | Not trusted for |
| --- | --- | --- |
| Browser | Displaying user choices and submitting wallet transactions | Inventing valuations, hashes, approvals, or ownership claims |
| Gemini | Producing evidence interpretation and a proposed valuation | Final authorization without deterministic validation |
| Underwriter service | Policy enforcement and mint authorization | Legal title, physical custody, or guaranteed appraisal accuracy |
| `RWAAsset` | Accepted issuance, supply, issuer, hashes, status, and balances | Physical-world possession or legal enforceability |
| Marketplace | Pool reserves, LP accounting, fees, and exchange settlement | External price truth or guaranteed liquidity |
| Neon | Fast durable discovery and historical snapshots | Canonical balances, ownership, reserves, or transaction settlement |
| Media repository | Availability of public generated artifacts | Mint authority, legal provenance, or immutable decentralized storage |
| Issuer | Self-attested description and permission to tokenize | Independently verified ownership unless an external verifier is added |

### Canonical data placement

| Data | Canonical location | Public |
| --- | --- | --- |
| ERC-1155 supply and balances | `RWAAsset` | Yes |
| Issuer, valuation, risk, status, report hash, metadata hash | `RWAAsset.assetInfo` | Yes |
| Pool reserves, liquidity, fixed-fee events | `RWAAMMMarketplace` | Yes |
| Normalized AI report | Public demo media or inline metadata | Usually |
| Original upload | Request memory only; never published as-is by the metadata pipeline | No |
| Generated or sanitized asset image | Public demo media or data URI | Yes |
| Underwriter, Gemini, database, and media credentials | Server environment | No |
| Portfolio and market read model | Neon when configured | Server-side cache |

XLayer Estate lets a user upload a clear original photo or a supporting record for a
physical item—such as a laptop, phone, camera, watch, cup, furniture, vehicle,
collectible, tool, appliance, or piece of equipment. Gemini identifies the
asset, estimates conservative second-hand value, flags obvious risk, and
returns a structured report. An approved report receives a server-side EIP-712
authorization and can be minted as an image-bearing ERC-1155 token on the
selected X Layer network. Testnet is available today; mainnet activates only
after fresh chain-196 contracts and settlement addresses are configured.

## AI RWE track justification

The AI is part of the economic control path rather than a cosmetic chatbot.
Gemini performs visual evidence gating, physical-asset classification,
condition extraction, conservative resale valuation, confidence scoring, and
risk flagging. The server hashes that canonical report and issues a short-lived
EIP-712 authorization for the selected chain and registry. Without the approved
AI report, matching asset image approval, metadata hash, and underwriter
signature, `RWAAsset.tokenizeProperty` cannot mint the one-million-share asset.
The resulting registry, liquidity seed, protocol fees, reserve changes, and
fractional trades settle on X Layer.

## Dual-network status

The global navigation includes a persistent X Layer network switcher. Testnet
is the default. Mainnet remains visibly disabled until all
`NEXT_PUBLIC_MAINNET_*` contract variables are present, preventing accidental
zero-address reads, signatures, approvals, or transactions.

| Network | Chain ID | Settlement | Current status |
| --- | ---: | --- | --- |
| X Layer Testnet | `1952` | `USDC_TEST` (project MockUSDC) | Registry, marketplace, indexer, and live dApp available |
| X Layer Mainnet | `196` | Verified six-decimal `USDC` | Deployment and explorer verification required |

The token represents **fractional exposure to a self-attested asset record**.
It does not prove legal ownership, transfer title, custody, authenticity, or a
claim against the physical item. This is a testnet software demonstration, not
an investment product, custody service, appraisal, legal opinion, or offer to
sell securities.

## Product flow

1. **Upload** — submit an original asset photo. Supporting documents may add
   context but cannot replace the photo for mint authorization.
2. **AI gate** — Gemini checks that the upload shows a recognizable, lawful,
   tangible asset. It does not require private receipts, identity documents,
   addresses, deeds, or ownership paperwork.
3. **Underwrite** — Gemini returns an asset category, visible brand/model,
   condition, conservative resale valuation range, confidence, and risk flags.
4. **Build twin** — Gemini attempts a gallery-style asset image. If provider
   image quota is unavailable, the protocol uses a metadata-stripped, resized
   WebP derivative of the submitted photo. Non-image evidence receives a
   deterministic protocol illustration. A server HMAC binds the selected twin
   to the approved report so the browser cannot swap it.
5. **Authorize** — the server signs a short-lived EIP-712 mint authorization.
   The browser cannot invent a report or bypass the underwriter.
6. **Mint** — the connected wallet mints one million ERC-1155 shares. Metadata
   includes the uploaded/generated image and a keccak256 report hash.
7. **List** — the issuer approves the marketplace, supplies matching shares and
   at least 10 USDC_TEST, and pays the fixed listing fee.
8. **Trade** — buyers and sellers swap fractional shares against the selected
   network's USDC in a constant-product AMM with slippage and deadline
   protection.

### Issuance state machine

```text
NO EVIDENCE
    │ upload original photo
    ▼
EVALUATING ───────────────→ REJECTED
    │                         no evaluation token; cannot mint
    ├─────────────────────→ MANUAL REVIEW
    │                         no mint authorization
    ▼
APPROVED
    │ generate/review twin
    ▼
MEDIA APPROVED
    │ canonicalize report + metadata
    ▼
AUTHORIZED
    │ signed wallet transaction before deadline
    ▼
MINTED ── approve shares ── approve seed + fee ── create pool ──→ LISTED
```

### Market state machine

```text
UNLISTED
  └─ issuer-only createPool(seed >= 10 USDC)
       ├─ transfers valuation-matched shares
       ├─ transfers full seed into reserves
       ├─ transfers fixed listing fee to collector
       └─ permanently locks the minimum-liquidity floor
              ▼
ACTIVE MARKET
  ├─ buy shares
  ├─ sell shares
  ├─ add proportional liquidity
  ├─ remove provider-owned liquidity above locked floor
  └─ stop trading when asset status is not active or marketplace is paused
```

### Protocol roles and powers

| Role | Capabilities | Restrictions |
| --- | --- | --- |
| Issuer | Mint an authorized asset, change its allowed lifecycle status, initialize its pool | Cannot mint without underwriting signature; cannot create another issuer's pool |
| Trader | Buy and sell shares with slippage and deadline protection | Must approve required tokens and pay the fixed action fee |
| Liquidity provider | Add proportional reserves and withdraw owned LP liquidity | Cannot remove permanently locked liquidity |
| Registry owner | Rotate underwriter; update asset status | Cannot rewrite existing report or metadata hashes |
| Marketplace owner | Pause and unpause exchange functions | Cannot change immutable registry, settlement token, or fee collector |
| Underwriter signer | Authorize normalized mint payloads | Signature is recipient-, chain-, registry-, nonce-, hash-, and deadline-bound |

## What can be uploaded?

The required primary input is a clear original photo of a physical item.
Examples:

- laptop, phone, tablet, monitor, camera, lens, headphones, or game console;
- watch, jewellery, fashion item, furniture, appliance, tool, or equipment;
- bicycle, vehicle, machine, collectible, instrument, artwork, or other lawful
  tangible goods;
- a non-confidential receipt, public listing, serial-number record, appraisal,
  or product record as additional context only.

The system rejects documents without an original photo as primary evidence and
may reject people, animals, food, services, ideas, financial instruments, illegal
goods, weapons, blank files, screenshots without a visible asset, unrecognizable
images, manipulated evidence, stock/catalog images, downloaded product photos,
watermarked commercial media, and contradictory records.
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
- The original upload is used for evaluation but is never published as-is.
  When Gemini image generation fails and the source is a photo, the pipeline
  removes metadata, applies orientation, bounds dimensions, and publishes only
  a compressed WebP derivative after displaying that fallback to the user.
- The server stores no local files. With `GITHUB_MEDIA_TOKEN`, generated twins,
  sanitized reports, and NFT metadata are written to a dedicated demo media
  repository and referenced by commit-pinned raw URLs. Without it, the demo
  uses content-addressed data URIs.
- The report hash is stored on-chain, not the raw report contents.
- GitHub demo storage is public and is not protocol-grade permanent storage.
  Never upload confidential material.
- The application does not verify legal ownership or physical custody.

## Asset twin generation API

`POST /api/generate-image` accepts `multipart/form-data`. JSON requests are not
supported because the same request may carry the source photo used for a safe
fallback.

| Field | Required | Description |
| --- | --- | --- |
| `report` | yes | Approved underwriting report encoded as JSON. |
| `evaluationToken` | yes | Short-lived server HMAC returned by `/api/underwrite`. |
| `attempt` | yes | One-based image attempt number. |
| `sourceFile` | no | JPEG, PNG, or WebP, maximum 4 MB; used only when Gemini returns no image. |
| `wallet` | conditional | Connected wallet address for a wallet-approved regeneration. |
| `signature` | conditional | Signature over the matching image approval message. |

The returned `image.status` is `generated`, `fallback_photo`, or
`fallback_svg`. The response also exposes `fallbackReason`, `storageWarning`,
`originalSourcePublished`, and `sourcePhotoUsed`. Clients must show those
disclosures before minting rather than silently labeling fallback media as an
AI-generated portrait.

Media persistence is fail-open for this testnet demo. When GitHub storage is
unconfigured or temporarily unavailable, the API returns a compact data URI and
a visible warning instead of blocking mint preparation. Data URIs are not a
protocol-scale persistence strategy.

## Marketplace and fees

The testnet quote asset is `USDC_TEST` with six decimals. It is the project’s
deployed `MockUSDC` contract, not official Circle USDC and not a token with
real-world value. The in-app faucet mints this protocol test currency for
local demonstrations only. OKB is not used for trading,
which avoids oracle and quote-asset complexity.

### Important test-token disclosure

The testnet marketplace is immutably deployed against:

```text
USDC_TEST / MockUSDC: 0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d
```

This is **not official X Layer or Circle USDC**. The in-app faucet calls the
project token's public `mint` function and issues 25 units for protocol testing.
Balances have no real-world value and must never be presented as redeemable
USDC. Moving to a different settlement token requires deploying a new
marketplace because the quote-token address is immutable.

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

### Pricing model

For share reserve `x`, settlement reserve `y`, and net trade input `Δ`, the AMM
uses a constant-product curve. The `0.30%` LP fee remains in the pool through
the reduced effective input:

```text
effectiveInput = poolInput × (10,000 - 30) / 10,000
sharesOut      = x × effectiveInput / (y + effectiveInput)
```

For buys, `poolInput` is the user's total settlement input minus the fixed
platform fee. For sells, the curve computes gross settlement output first and
the fixed platform fee is then deducted. The UI must treat `quoteBuy` and
`quoteSell` as estimates and pass user-controlled minimum outputs and deadlines
to the state-changing functions.

### Economic invariants

- Each token ID has at most one active pool in a marketplace deployment.
- Only the registry-recorded issuer can initialize that pool.
- The full user-selected seed becomes pool reserve; the listing fee is separate.
- Initial shares are derived from the AI launch valuation and fixed token supply.
- Low-valued assets cannot require more than the total issued supply; the share
  contribution is capped at `1,000,000` units.
- Liquidity representing the first `10.00` settlement units is permanently
  locked and cannot be withdrawn.
- Platform fees are transferred to the immutable collector and are excluded
  from reserve pricing.
- A buy or sell that cannot cover the fixed fee or produce nonzero output
  reverts.
- Trading and liquidity operations require an active registry asset and an
  unpaused marketplace.

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
- Google Gemini structured JSON underwriting and generated asset twins.
- Event-indexed wallet portfolio discovery using registry, transfer, and market
  logs rather than a centralized database.

### Registry write surface

| Function | Caller | Purpose | Principal checks |
| --- | --- | --- | --- |
| `tokenizeProperty(...)` | Any submitter for signed recipient | Create the asset record and mint ERC-1155 shares | Valid EIP-712 signer, unused digest, unexpired deadline, nonzero hashes, valid valuation and supply |
| `setStatus(tokenId, status)` | Registry owner or recorded issuer | Move an asset between allowed lifecycle states | Existing token, authorized caller, status `0..3` |
| `setUnderwriter(address)` | Registry owner | Rotate the accepted signing identity | Nonzero address |

The legacy function name `tokenizeProperty` is retained for deployed ABI
compatibility even though the protocol now supports many categories of lawful
tangible assets.

### Marketplace write surface

| Function | Caller | Purpose | Principal checks |
| --- | --- | --- | --- |
| `createPool(tokenId, seed)` | Recorded issuer | Initialize valuation-anchored liquidity | Active asset, no existing pool, minimum seed, approvals, seed plus fixed fee |
| `addLiquidity(...)` | Any provider | Add proportional reserves | Active pool, ratio-conforming assets, minimum LP output |
| `removeLiquidity(...)` | LP owner | Withdraw owned reserves | Sufficient LP balance, locked-liquidity preservation, minimum outputs |
| `buy(...)` | Trader | Exchange settlement token for shares | Active pool, amount above fixed fee, deadline, minimum shares |
| `sell(...)` | Trader | Exchange shares for settlement token | Active pool, nonzero shares, output above fixed fee, deadline, minimum settlement output |
| `pause()` / `unpause()` | Marketplace owner | Emergency exchange control | Owner-only |

### Events for indexers

| Contract | Events |
| --- | --- |
| Registry | `AssetTokenized`, `AssetStatusChanged`, `UnderwriterChanged`, ERC-1155 `TransferSingle` / `TransferBatch` |
| Marketplace | `PoolCreated`, `SharesPurchased`, `SharesSold`, `LiquidityAdded`, `LiquidityRemoved`, `PlatformFeePaid` |

An indexer should use `(chain_id, token_id)` as the asset identity. Token IDs
are only unique inside a registry deployment and must never be joined across
testnet and mainnet without a chain key.

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

### Development prerequisites

- Node.js 20 or newer;
- npm with the committed `package-lock.json`;
- an injected EVM wallet for browser transaction testing;
- X Layer testnet OKB for gas;
- project `USDC_TEST` from the in-app protocol faucet for marketplace testing;
- optional Gemini credentials for live underwriting and image generation;
- optional Neon and GitHub media credentials for durable indexing and media.

### Common commands

```bash
npm install                 # install root dependencies
npm run build               # production Next.js build
npx next start -p 3000      # serve the built application
npm run test:unit           # Node/TypeScript unit suites
npm run compile             # compile Solidity with Hardhat
npm run test:contract       # registry and marketplace contract tests
npm run preflight:mainnet   # read-only chain-196 deployment checks
```

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`, `.env.build`,
private keys, Gemini keys, media tokens, or session secrets.

### Browser-visible

- `NEXT_PUBLIC_RWA_ADDRESS` — deployed registry address.
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS` — deployed fee-aware marketplace.
- `NEXT_PUBLIC_USDC_ADDRESS` — six-decimal USDC_TEST address.
- `NEXT_PUBLIC_FEE_COLLECTOR` — display-only collector address.
- `NEXT_PUBLIC_RWA_DEPLOYMENT_BLOCK` — first registry event scan block.
- `NEXT_PUBLIC_MARKETPLACE_DEPLOYMENT_BLOCK` — first marketplace scan block.

### Server-only

- `GEMINI_API_KEY` — enables live analysis and asset-twin generation.
- `GEMINI_TEXT_MODEL` / `GEMINI_IMAGE_MODEL` — optional model overrides.
- `GITHUB_MEDIA_TOKEN` — optional fine-grained demo-media repository token.
- `GITHUB_MEDIA_REPO` / `GITHUB_MEDIA_BRANCH` — media destination configuration.
- `UNDERWRITER_PRIVATE_KEY` — server-only signing key; never use the deployer
  key here.
- `UNDERWRITER_SESSION_SECRET` — HMAC secret for evaluation sessions.
- `DATABASE_URL` — optional Neon PostgreSQL connection string for the read model.
- `INDEXER_SECRET` — shared secret protecting synchronization and refresh jobs.

### Environment ownership matrix

| Variable class | Local file | Vercel | Browser-visible | Commit |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_*` contract configuration | `.env.local` | Preview/Production | Yes | Never commit real environment files |
| Gemini, underwriter, database, indexer, media secrets | `.env.local` or secure shell | Encrypted server variables | No | Never |
| Deployment private key and network deployment inputs | `.env.build` | Not required by web app | No | Never |
| Dummy names and safe example values | `.env.example` | No | N/A | Yes |

### Durable indexing and live prices

The contracts remain authoritative for ownership, balances, pool reserves, and
trades. The dashboard and marketplace use server-side individual reads because
X Layer testnet does not expose the Multicall3 contract expected by generic
Viem multicall helpers. When configured, Neon stores a durable read model for
assets, holdings, markets, and historical price snapshots; if Neon is absent or
temporarily unavailable, the APIs fall back to direct X Layer reads.

Set `DATABASE_URL` and `INDEXER_SECRET` in Vercel. The GitHub Actions workflow
`.github/workflows/sync-index.yml` runs every five minutes; configure repository
secrets `INDEXER_SYNC_URL` (the production `/api/index/sync` URL) and
`INDEXER_SECRET` with the same value as Vercel. After a confirmed mint, listing,
buy, sell, or liquidity transaction, the client also requests an immediate
index refresh.

Listed cards and market detail show the live AMM spot price per ERC-1155 share,
the implied market cap, and price movement from the launch price. The fixed
protocol fee is excluded from reserve pricing because it is paid to the fee
collector rather than deposited into the pool.

#### Read-path priority

1. Query the chain-scoped Neon snapshot when configured.
2. Reconcile current balances and pool state through X Layer RPC reads.
3. Trigger an immediate index refresh after confirmed economic transactions.
4. Run the authenticated scheduled sync to discover transactions created by
   other wallets or clients.
5. If Neon is unavailable, return direct-chain data or a clearly marked stale
   snapshot instead of silently returning an empty portfolio.

Neon is a performance and continuity layer, not a ledger. Database rows must be
rebuildable from deployment configuration, contract events, and current reads.

### Provision the public media repository

Use a dedicated public repository. Do not grant the application write access
to the source repository or to the rest of the account.

```bash
gh auth login -h github.com
gh repo create TS-mfon/xlayer-estate-media \
  --public \
  --add-readme \
  --description "Public generated media and metadata for XLayer Estate testnet assets"
```

Create a fine-grained GitHub personal access token with:

- resource owner: `TS-mfon`;
- repository access: only `xlayer-estate-media`;
- repository permission: **Contents — Read and write**;
- metadata permission: read-only;
- a short expiration, such as 90 days.

Add the token to Vercel without writing it to a tracked file:

```bash
read -rsp "GitHub media token: " GITHUB_MEDIA_TOKEN; echo
printf '%s' "$GITHUB_MEDIA_TOKEN" | \
  npx vercel env add GITHUB_MEDIA_TOKEN production --force --sensitive --yes
unset GITHUB_MEDIA_TOKEN
```

Set `GITHUB_MEDIA_REPO=TS-mfon/xlayer-estate-media` and
`GITHUB_MEDIA_BRANCH=main` in the same Vercel environment, then create a new
deployment so Functions receive the variables. Never commit the token,
`.env.local`, or `.env.build`.

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

### Mainnet deployment gate

Mainnet deployment is deliberately confirmation-gated. Configure
`XLAYER_MAINNET_RPC`, `MAINNET_USDC_ADDRESS`, `MAINNET_FEE_COLLECTOR`, the
deployer key, and the underwriter address in the ignored `.env.build`, then run:

```bash
npm run compile
npm run preflight:mainnet
```

The read-only preflight verifies chain ID `196`, settlement-token bytecode,
`USDC` symbol, six decimals, required contract artifacts, and deployer balance.
It never broadcasts a transaction. After reviewing its output and funding the
deployer with mainnet OKB, explicitly authorize the deployment:

```bash
CONFIRM_MAINNET_DEPLOY=YES npm run deploy:mainnet
```

The deployer prints fresh registry, marketplace, deployment-block, and Vercel
environment values. Never reuse testnet addresses on mainnet, and do not enable
the mainnet switch until explorer source verification and read-only smoke tests
pass.

## Test suite

```bash
npx tsc --noEmit --pretty false
npm run compile
npm run test:unit
npm run test:contract
git diff --check
```

The Hardhat suite covers signed minting, replay protection, invalid signatures,
valuation-anchored liquidity, locked minimum liquidity, buy/sell settlement,
non-issuer rejection, fee collection, minimum trade size, and low-value asset
markets.

### Current automated coverage

| Area | Assertions |
| --- | --- |
| Attestation | Canonical report hashing, expiry, tamper rejection, image binding, cross-network isolation |
| Media | Bounded WebP fallback, provider quota fallback, deterministic illustration |
| ABI compatibility | Frontend ABIs match compiled artifacts and deployed mapping getter shape |
| Registry discovery | Enumeration, normalization, malformed-record rejection, RPC batching |
| Marketplace UI state | Approval ordering, balance gating, valuation-anchored share requirement |
| Pricing | Live share price, implied market capitalization, historical movement |
| Contracts | Signed minting, replay defense, pool creation, fixed fees, swaps, LP operations, pause/status controls, underwriter rotation |

### Release gate

A release candidate is acceptable only when all of the following pass:

```bash
npx tsc --noEmit --pretty false
npm run compile
npm run test:unit
npm run test:contract
npm run build
git diff --check
```

For contract-address or settlement-token changes, automated tests are not
sufficient. Complete a wallet smoke test for upload, authorization, mint,
listing, buy, sell, dashboard discovery, marketplace discovery, fee receipt,
and index persistence on the target network.

## User testing checklist

1. Use a public or personal photo of a laptop, cup, camera, watch, or other
   lawful physical item. Do not upload confidential documents.
2. Upload the image on `/tokenize`.
3. Confirm the AI report identifies the item, shows a conservative valuation,
   and generates a reviewable digital twin.
4. Connect the deployer/test wallet on X Layer testnet.
5. Mint the ERC-1155 asset and confirm the automatic marketplace-listing redirect.
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

### Security model summary

- The deployer key and underwriter key must be different identities.
- The underwriter key is a hot server key in the current architecture and
  should be migrated to managed signing or an HSM before production use.
- EIP-712 authorizations bind recipient, chain, registry, valuation, risk,
  report hash, metadata hash, supply, nonce, and deadline.
- Authorization digests are single-use and contract-enforced.
- ERC-20 transfers use `SafeERC20`; marketplace state-changing exchange paths
  use `ReentrancyGuard` and `Pausable`.
- Marketplace constructor parameters are immutable. A compromised collector or
  incorrect quote-token deployment requires marketplace replacement.
- No oracle is currently used. The initial ratio is derived from the signed AI
  launch valuation; subsequent price discovery is entirely pool-driven.
- Thin pools can be manipulated. A displayed AMM price is not an independent
  appraisal or guaranteed exit price.

### Incident response

1. Pause the marketplace if settlement or allowance behavior is uncertain.
2. Mark affected registry assets inactive or flagged where appropriate.
3. Rotate the underwriter immediately if signing integrity may be compromised.
4. Preserve transaction hashes, event logs, signed payloads, canonical reports,
   deployment blocks, and relevant application logs.
5. Publish affected networks, addresses, token IDs, and the exact incident
   window.
6. Deploy a replacement immutable marketplace when the settlement token or fee
   collector must change.
7. Rebuild the Neon read model from chain state after remediation.

### Mainnet readiness requirements

Do not describe the protocol as mainnet-live until every item is complete:

- verified X Layer chain ID `196` RPC response;
- verified six-decimal production settlement token;
- separately funded, least-privilege deployer and underwriter identities;
- fresh registry and marketplace deployments;
- published and verified source code on the X Layer explorer;
- production media persistence replacing demo-only GitHub storage where needed;
- durable indexer monitoring, alerting, backup, and replay procedure;
- external smart-contract security review;
- legal review of fractional asset representation and marketplace operation;
- end-to-end mint/list/trade smoke test with production addresses;
- explicit enabling of all `NEXT_PUBLIC_MAINNET_*` variables only after review.

## Submission readiness audit

- **Passing:** TypeScript, production Next.js build, unit tests, and all nine
  registry/marketplace contract tests.
- **Passing:** X Layer testnet chain ID `1952`, contract-backed AI economic
  authorization, chain-bound signing, dual-network query isolation, durable
  Neon indexing, and credential ignore rules.
- **Blocker:** fresh X Layer mainnet registry and marketplace deployments plus
  explorer source verification are still required before claiming mainnet
  readiness.
- **Blocker:** add the project's dedicated X/Twitter profile URL before the
  hackathon submission. The repository intentionally does not invent one.
- **Blocker:** add a public demo-video URL if the submission form requires one;
  local navigation recordings are ignored and are not committed.

## Project layout

```text
contracts/RWAAsset.sol             ERC-1155 asset registry and signed minting
contracts/RWAAMMMarketplace.sol    USDC AMM, liquidity lock, and platform fees
src/app/api/underwrite             Gemini tangible-asset gate and valuation
src/app/api/generate-image          Gemini twin generation and persistence
src/app/api/metadata                report/metadata persistence and signing
src/app/tokenize                    upload → evaluate → twin → mint → list flow
src/app/marketplace                 event-indexed market discovery and trading UI
src/app/dashboard                   wallet assets, live markets, and holdings
src/components/CinematicHome.tsx   cinematic landing experience
src/lib/attestation.ts              report hashing and mint authorization
src/lib/abi.ts                      frontend contract interfaces
src/lib/events.ts                   chunked on-chain event portfolio discovery
src/lib/github-storage.ts           commit-pinned demo artifact persistence
test/RWAAsset.test.js               registry and marketplace tests
tests/                              TypeScript policy, media, ABI, pricing, and state tests
docs/PROTOCOL.md                    normative protocol mechanics
docs/ARCHITECTURE.md                components, trust boundaries, and failure modes
docs/SECURITY.md                    risk model, key management, and response plan
docs/INTEGRATION.md                 read/write integration sequences
docs/OPERATIONS.md                  deployment and production runbooks
```

## Contributing and change control

Protocol changes should be narrow, reviewable, and accompanied by tests. A pull
request that changes signed fields, ABI shapes, economics, deployment addresses,
chain selection, or index keys must also update the relevant documentation and
operator runbook.

Before opening a pull request:

1. confirm no `.env*`, private key, API token, database URL, wallet seed, or
   generated user evidence is staged;
2. run the complete release gate;
3. document storage or schema migrations;
4. state whether existing registry tokens and marketplace pools remain
   compatible;
5. include target-network addresses and deployment blocks when applicable;
6. avoid importing from the `wagmi/connectors` barrel—use supported deep imports
   so optional Coinbase/x402 packages are not pulled into the Next.js build;
7. keep OpenZeppelin pinned to `4.9.5` unless the X Layer EVM opcode impact and
   storage compatibility have been explicitly reviewed.

## License and protocol notice

The Solidity sources declare the MIT SPDX identifier. This repository is an
experimental protocol implementation and does not provide legal, investment,
custody, appraisal, insurance, authenticity, or regulatory advice. Deployment
operators are responsible for reviewing the applicable license, local law,
consumer disclosures, asset eligibility, sanctions controls, and marketplace
requirements before enabling real-value use.
