# XLayer Estate Cinematic Site Prompt

Build a cinematic multi-route landing and dApp interface for **XLayer Estate**, an AI-underwritten real-estate tokenization and fractional marketplace product on X Layer. Preserve the existing Next.js, TypeScript, Tailwind, wagmi, viem, GSAP, React Three Fiber, and smart-contract integrations.

Use a black background, white Space Mono typography, full-viewport videos, scramble-text entrances, mouse-scrubbed hero video, translucent navigation capsules, smooth 3D scroll transforms, parallax, micro-interactions, and restrained cyan/violet highlights. Do not use generic architecture-room imagery: the visual story is property evidence becoming verified underwriting, an NFT image and report hash, one million ERC-1155 shares, and a USDC liquidity pool.

Hero copy: **“Evidence Into Equity / One Asset Open Market.”** The hero video is paused and scrubbed by horizontal mouse movement. Overlay a faint dot grid and the large watermark **“VERIFIED.”** Primary actions are “Underwrite property” and “Open marketplace.”

The second full-screen section explains that a strict AI document gate rejects non-property, suspicious, and incomplete files; approved reports receive a server EIP-712 authorization that cannot be forged in the browser.

The metrics section shows: **75+ evidence threshold**, **1M shares per property**, and **$10 minimum USDC liquidity**.

The technology section reveals four product layers: Document Gate, Signed Mint, USDC Pool, and Open Trading. Explain that the initial share price is anchored to Gemini’s conservative lower-bound valuation and that minimum launch liquidity stays locked.

Functional routes must keep the same cinematic system: `/tokenize` for document/photo upload and approval decisions, `/dashboard` for the on-chain registry, `/marketplace` for listed assets, and `/marketplace/[tokenId]` for approve/seed/buy/sell flows. Every wallet transaction needs loading, confirmation, rejection, wrong-network, insufficient-balance, allowance, slippage, deadline, and RPC error states.
