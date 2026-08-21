"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NETWORKS } from "@/lib/network";

type DocSection = {
  id: string;
  group: string;
  title: string;
  summary: string;
  body: React.ReactNode;
};

const testnet = NETWORKS[1952];

const sections: DocSection[] = [
  {
    id: "start",
    group: "Start here",
    title: "What is XLayer Estate?",
    summary: "An AI-gated issuance and liquidity protocol for lawful physical assets.",
    body: <>
      <p>XLayer Estate turns an original photo of a physical object into a structured asset record, an image-bearing ERC-1155 token, and an optional USDC-denominated market on X Layer.</p>
      <div className="docs-flow"><span>Photo</span><b>→</b><span>AI review</span><b>→</b><span>Asset twin</span><b>→</b><span>Mint</span><b>→</b><span>Liquidity</span></div>
      <p className="docs-callout warning">A token is a self-attested protocol record. It does not prove legal ownership, custody, authenticity, title, redemption, or a claim against the physical item.</p>
    </>,
  },
  {
    id: "quick-start",
    group: "Start here",
    title: "Quick start",
    summary: "Try the complete testnet flow in a few minutes.",
    body: <ol className="docs-list numbered"><li>Connect an EVM wallet and switch to X Layer Testnet.</li><li>Open <Link href="/tokenize">Tokenize</Link> and upload a clear, original photo of a lawful physical item.</li><li>Review the AI report and generated asset twin.</li><li>Sign the ERC-1155 mint transaction.</li><li>Continue to the guided listing flow and seed at least `10.00 USDC_TEST`.</li><li>Open the <Link href="/marketplace">Marketplace</Link> to buy or sell fractional shares.</li></ol>,
  },
  {
    id: "issuer-flow",
    group: "For issuers",
    title: "Originate and list an asset",
    summary: "The issuer journey is intentionally sequential and wallet-controlled.",
    body: <div className="docs-timeline">{[
      ["01", "Capture", "Upload one original photo with the entire item visible."],
      ["02", "Underwrite", "Gemini classifies the asset, estimates conservative resale value, and assigns risk signals."],
      ["03", "Twin", "Review the generated image or a disclosed sanitized fallback."],
      ["04", "Mint", "A short-lived EIP-712 authorization allows the wallet to mint one million ERC-1155 shares."],
      ["05", "List", "Approve shares, approve the settlement token, then create the market with the initial seed."],
    ].map(([number, title, text]) => <div key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>,
  },
  {
    id: "evidence",
    group: "For issuers",
    title: "Evidence and AI policy",
    summary: "Photo-first evidence keeps the flow useful without requiring confidential documents.",
    body: <><p>Upload a laptop, cup, camera, watch, furniture item, vehicle, collectible, tool, appliance, or other lawful tangible object. A receipt or public record may add context, but it cannot replace the original photo.</p><div className="docs-columns"><div><h3>Usually accepted</h3><ul className="docs-list"><li>Original phone photo</li><li>Recognizable physical asset</li><li>Visible condition and details</li><li>Lawful, non-sensitive item</li></ul></div><div><h3>Rejected or escalated</h3><ul className="docs-list"><li>Downloaded stock/catalog image</li><li>People, animals, services, or ideas</li><li>Manipulated, synthetic, or watermarked evidence</li><li>Weapons, illegal goods, or sensitive documents</li></ul></div></div><p className="docs-callout">If an upload is rejected, take a new photo in good lighting, use a different angle, remove unrelated objects, and keep the entire item inside the frame.</p></>,
  },
  {
    id: "trading",
    group: "For traders",
    title: "Buying and selling shares",
    summary: "Each listed asset has its own constant-product USDC market.",
    body: <><p>Buyers enter a total settlement amount. The protocol deducts the fixed action fee, applies the liquidity-provider swap fee, and sends the remainder through the pool curve. Sellers receive net settlement output after the fixed fee.</p><div className="docs-equation"><code>effective input = pool input × (10,000 − 30) / 10,000</code><code>buy output = share reserve × input / (USDC reserve + input)</code></div><ul className="docs-list"><li>Every trade includes a minimum-output floor and deadline.</li><li>Thin pools can have high price impact and are not guaranteed exit liquidity.</li><li>Displayed prices are AMM reserve prices, not independent appraisals.</li></ul></>,
  },
  {
    id: "fees",
    group: "For traders",
    title: "Fees and liquidity",
    summary: "The fee model is fixed, visible, and encoded in the marketplace deployment.",
    body: <div className="docs-stat-grid"><div><strong>10.00</strong><span>Minimum initial USDC_TEST seed</span></div><div><strong>0.20</strong><span>USDC_TEST fixed listing/buy/sell fee</span></div><div><strong>0.30%</strong><span>Liquidity-provider swap fee</span></div></div>,
  },
  {
    id: "architecture",
    group: "Protocol",
    title: "Architecture and trust boundaries",
    summary: "The browser orchestrates; the server authorizes; X Layer settles.",
    body: <><div className="docs-architecture"><span>Browser wallet</span><b>→</b><span>Next.js APIs + Gemini</span><b>→</b><span>RWAAsset + Marketplace</span></div><p>The browser is untrusted and cannot invent a valid mint authorization. Gemini produces advisory output that must pass deterministic validation. The underwriter signs the canonical payload. Contracts are authoritative for token supply, balances, pools, fees, and status.</p><Link className="docs-inline-link" href="https://github.com/TS-mfon/xlayer-estate/blob/main/docs/ARCHITECTURE.md" target="_blank">Read the full architecture specification ↗</Link></>,
  },
  {
    id: "contracts",
    group: "Protocol",
    title: "Contracts and events",
    summary: "ERC-1155 issuance and per-asset AMM markets are separately inspectable.",
    body: <><div className="docs-contract"><h3>RWAAsset</h3><p>Stores issuer, valuation, launch valuation, risk score, lifecycle status, report hash, metadata hash, URI, and ERC-1155 balances.</p><code>tokenizeProperty · assetInfo · uri · setStatus · balanceOf</code></div><div className="docs-contract"><h3>RWAAMMMarketplace</h3><p>Stores pool reserves, liquidity accounting, fixed fees, and trade settlement.</p><code>createPool · quoteBuy · quoteSell · buy · sell · addLiquidity · removeLiquidity</code></div><p>Indexers should consume `AssetTokenized`, ERC-1155 transfers, `PoolCreated`, `SharesPurchased`, `SharesSold`, and `PlatformFeePaid`.</p></>,
  },
  {
    id: "api",
    group: "Developer integration",
    title: "API integration",
    summary: "The web app exposes a small, server-side pipeline for evidence, media, and indexing.",
    body: <div className="docs-api-list">{[
      ["POST /api/underwrite", "Submit multipart evidence and receive a normalized report plus short-lived evaluation token."],
      ["POST /api/generate-image", "Generate or safely fall back to an asset twin bound to the approved report."],
      ["POST /api/metadata", "Persist metadata, calculate hashes, and receive the EIP-712 mint authorization."],
      ["GET /api/assets", "Read a wallet’s chain-scoped asset and holding view."],
      ["GET /api/markets", "Read listed assets and current market pricing."],
      ["POST /api/index/refresh", "Request immediate reconciliation after a confirmed transaction."],
    ].map(([route, text]) => <div key={route}><code>{route}</code><p>{text}</p></div>)}</div>,
  },
  {
    id: "networks",
    group: "Operations",
    title: "Networks and addresses",
    summary: "Testnet is live; mainnet remains gated until fresh deployments are verified.",
    body: <><div className="docs-network-banner"><span className="live-pulse"/> X Layer Testnet · chain ID 1952 · operational</div><div className="docs-addresses"><Address label="Registry" value={testnet.registry}/><Address label="Marketplace" value={testnet.marketplace}/><Address label="USDC_TEST / MockUSDC" value={testnet.usdc}/><Address label="Fee collector" value={testnet.feeCollector}/></div><p className="docs-callout warning">`USDC_TEST` is project MockUSDC. It is not official Circle USDC and has no real-world value. Mainnet is not enabled until chain-196 addresses and explorer verification are configured.</p></>,
  },
  {
    id: "security",
    group: "Operations",
    title: "Security, privacy, and limitations",
    summary: "The protocol is non-custodial but experimental.",
    body: <><ul className="docs-list"><li>Never upload private keys, seed phrases, passports, bank statements, or confidential contracts.</li><li>The original upload is not published as-is by the metadata pipeline.</li><li>Underwriting signatures are recipient-, chain-, registry-, hash-, nonce-, and deadline-bound.</li><li>Neon is a rebuildable read cache; contracts remain authoritative.</li><li>The protocol does not custody, insure, ship, redeem, or authenticate physical goods.</li><li>External security, legal, and regulatory review is required before real-value mainnet use.</li></ul><Link className="docs-inline-link" href="https://github.com/TS-mfon/xlayer-estate/blob/main/docs/SECURITY.md" target="_blank">Read the full security model ↗</Link></>,
  },
  {
    id: "developers",
    group: "Developer integration",
    title: "Run locally",
    summary: "Build and test the protocol without exposing credentials.",
    body: <><pre className="docs-code"><code>{`npm install\ncp .env.example .env.local\nnpm run build\nnpx next start -p 3000\n\n# validation\nnpx tsc --noEmit --pretty false\nnpm run test:unit\nnpm run test:contract`}</code><button type="button" onClick={() => navigator.clipboard?.writeText("npm install\ncp .env.example .env.local\nnpm run build\nnpx next start -p 3000")}>Copy</button></pre><p>Keep `.env.local`, `.env.build`, private keys, Gemini keys, database URLs, and media tokens out of Git.</p><Link className="docs-inline-link" href="https://github.com/TS-mfon/xlayer-estate" target="_blank">Open the repository ↗</Link></>,
  },
];

export default function DocsPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("start");
  const filtered = useMemo(() => sections.filter((section) => `${section.title} ${section.summary} ${section.group}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const activeSection = filtered.find((section) => section.id === active) ?? filtered[0] ?? sections[0];
  return <div className="page-frame docs-page">
    <header className="docs-hero"><div><p className="kicker">XLayer Estate / Protocol docs</p><h1>Understand the<br/><em>asset protocol.</em></h1><p>Everything users, issuers, traders, integrators, and operators need to move through XLayer Estate with confidence.</p><div className="hero-actions"><Link className="button button-primary" href="/tokenize">Start tokenizing ↗</Link><Link className="button button-ghost" href="/marketplace">Browse markets</Link></div></div><div className="docs-hero-card"><span className="docs-orbit">✦</span><strong>TESTNET LIVE</strong><small>Chain 1952 · contracts + indexer</small><span className="docs-hero-line"/></div></header>
    <div className="docs-toolbar glass-panel"><label><span>Search documentation</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try: fees, minting, security…" /></label><span className="docs-result-count">{filtered.length} sections</span></div>
    <div className="docs-layout"><aside className="docs-sidebar" aria-label="Documentation navigation">{["Start here", "For issuers", "For traders", "Protocol", "Developer integration", "Operations"].map((group) => { const items = filtered.filter((section) => section.group === group); if (!items.length) return null; return <div key={group} className="docs-nav-group"><p>{group}</p>{items.map((section) => <button type="button" key={section.id} className={activeSection.id === section.id ? "active" : ""} onClick={() => { setActive(section.id); document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{section.title}</button>)}</div>; })}</aside><main className="docs-content">{filtered.map((section) => <article id={section.id} className={`docs-section ${activeSection.id === section.id ? "is-active" : ""}`} key={section.id}><div className="docs-section-heading"><p className="kicker">{section.group}</p><h2>{section.title}</h2><p>{section.summary}</p></div><div className="docs-section-body">{section.body}</div></article>)}{!filtered.length && <div className="estate-empty glass-panel"><span>⌕</span><h2>No matching documentation.</h2><p>Try searching for minting, liquidity, API, or security.</p></div>}</main></div>
  </div>;
}

function Address({ label, value }: { label: string; value: string }) { return <div className="docs-address"><span>{label}</span><code>{value}</code><button type="button" onClick={() => navigator.clipboard?.writeText(value)}>Copy</button></div>; }
