# XLayer Estate Protocol — Cinematic Interface Build Prompt

Build a cinematic, production-grade multi-route protocol interface for
**XLayer Estate**, a privacy-first AI physical-asset tokenization and USDC
liquidity protocol on X Layer. Preserve the existing Next.js 14 App Router,
TypeScript, Tailwind CSS, wagmi, viem, TanStack Query, Framer Motion, GSAP
ScrollTrigger, Three.js, React Three Fiber, and Solidity integrations.

This is protocol infrastructure, not a generic NFT landing page. The visual
system must communicate evidence ingestion, AI interpretation, signed issuance,
on-chain provenance, liquidity formation, and transparent fees. Never imply
that AI verifies legal ownership. Every relevant view must say that ownership is
self-attested and not legally verified.

## Visual language

- Black atmospheric background with white Space Mono typography.
- Anton SC only for oversized low-opacity watermark text.
- Full-viewport video fields, holographic glass panels, sparse cyan/violet
  highlights, animated grid lines, soft bloom, scanlines, and subtle particles.
- Mouse-scrubbed hero video; other videos autoplay muted and loop.
- Framer Motion entrance, hover, loading, and route-state transitions.
- Pointer parallax and micro-interactions must feel precise, not playful.
- Keep UI chrome minimal during cinematic sequences.
- Respect `prefers-reduced-motion`; show all information without scroll effects.
- Do not use architecture, rooms, neural-network product copy, or generic crypto
  coins. Visualize physical asset evidence becoming a protocol market.

## Hero

Use the split headline:

```text
Anything Real / Into Equity
One Photo / Open Market
```

A paused full-screen video is scrubbed by horizontal mouse movement. Overlay a
faint dot grid and the watermark `TOKENIZED`. Explain that a laptop, camera,
watch, cup, vehicle, collectible, tool, or other physical object can become an
AI-valued image-bearing ERC-1155 asset with USDC liquidity on X Layer.

Primary actions:

- `Tokenize an asset`
- `Open marketplace`

## Scroll-driven build sequence

Create one pinned section lasting approximately five viewport-heights. Use a
**single GSAP ScrollTrigger timeline** with `pin: true` and `scrub`—not separate
autoplay animations.

The sequence assembles one protocol object in five stages:

1. **Capture** — a holographic photo panel slides in, representing a clear photo
   of a physical object. State that confidential ownership documents are not
   required.
2. **Identify** — a scanning beam and evidence nodes reveal as Gemini identifies
   category, visible brand/model, condition, manipulation risk, and prohibited
   goods.
3. **Value** — a valuation panel builds with conservative second-hand USD range,
   lower-bound launch value, confidence, and risk.
4. **Tokenize** — an EIP-712 authorization crystal and keccak256 fingerprint
   assemble; one million ERC-1155 shares orbit the asset core.
5. **Liquidity** — a green USDC reserve ring closes around the result. Explain
   the 10 USDC minimum seed, permanent liquidity lock, 0.30% LP fee, and fixed
   0.20 USDC platform fee on listing, buying, and selling.

Each stage must fade, slide, scale, and deblur at a distinct timeline threshold.
The 3D scene must respond to the same continuous scroll progress. Do not trigger
independent card animations.

After the five stages are complete:

- center the XLayer Estate protocol logo over the assembled scene;
- reveal the `Tokenize an asset` action;
- dispatch the nav-reveal state so the fixed navigation fades back in;
- reverse cleanly when the user scrolls upward.

## Supporting cinematic sections

### Privacy-first evidence

Use 3D perspective text to explain that a clear photo can be sufficient for AI
identification and valuation. Receipts and ownership records are optional.
Warn that IPFS is public and confidential material must not be uploaded.

### Protocol metrics

Show:

- `1M` — shares per asset;
- `$10` — minimum USDC liquidity;
- `$0.20` — fixed platform fee per listing, buy, or sell.

### Valuation into liquidity

Reveal four protocol layers:

- Photo-First Gate
- Signed Mint
- USDC Pool
- Transparent Fees

Explain that launch pricing uses the conservative lower valuation bound and
that low-value assets use a 10 USDC minimum market-cap floor without changing
the stored AI valuation.

## Application routes

### `/tokenize`

- Dropzone accepts images first, plus PDF/TXT/Markdown/CSV/JSON evidence.
- Examples: laptop, cup, phone, camera, watch, furniture, vehicle, collectible,
  equipment, tool, appliance, artwork.
- Automatically reuse an uploaded image as the NFT image.
- Show asset name, category, brand/model, condition, identifier, evidence,
  authenticity, valuation confidence, range, launch value, risk, and decision.
- Always show `Ownership: Self-attested / not verified`.
- Approved reports expose the signed mint transaction.
- Rejected/manual-review reports explain exactly why minting is unavailable.
- Handle file limits, unsupported files, Gemini outage, wallet disconnect, wrong
  network, signature rejection, expired authorization, RPC failure, and reverted
  transactions.

### `/dashboard`

- Display all registry assets with NFT image, issuer, AI valuation, launch
  valuation, risk, lifecycle status, report link, explorer link, and market link.
- Do not label records as legally verified property or ownership.

### `/marketplace`

- Display every asset market, active/inactive state, launch value, spot share
  price, USDC reserve, and risk.
- Explain that markets trade self-attested asset records.

### `/marketplace/[tokenId]`

- Issuer listing flow: ERC-1155 approval, USDC approval for seed plus 0.20 fee,
  then market creation.
- Buy input is total USDC including the fixed 0.20 fee; quote shares net of the
  platform fee.
- Sell quote is net USDC after the fixed 0.20 fee.
- Show the immutable fee collector address, 0.30% LP fee, 1% UI slippage guard,
  transaction deadline, pool reserves, locked liquidity, user balances, and all
  error/confirmation states.

## Protocol accuracy requirements

- X Layer testnet chain ID is `1952`, never `195`.
- Mainnet chain ID is `196`.
- Use USDC_TEST with six decimals.
- Keep OpenZeppelin pinned to `4.9.5`.
- Never import from the `wagmi/connectors` barrel.
- The browser never holds the underwriter or deployer private key.
- Minting requires a server EIP-712 authorization.
- The raw report is represented on-chain by a keccak256 hash.
- The platform does not prove legal ownership, custody, authenticity, delivery,
  redemption, or investment returns.

The final experience should feel like a protocol terminal assembling an asset
market in real time: cinematic and technically credible, with every visual
state grounded in an actual contract or AI lifecycle state.
