# Security and Risk Model

## Non-goals

XLayer Estate does not verify legal ownership, custody, provenance, redemption,
delivery, insurance, liens, authenticity, regulatory status, or securities-law
compliance. The protocol must not present AI recognition as proof of ownership.

## Key management

- `PRIVATE_KEY` is deployment-only and belongs in `.env.build`.
- `UNDERWRITER_PRIVATE_KEY` is server-only and must be distinct from the
  deployer key.
- `GEMINI_API_KEY`, `GITHUB_MEDIA_TOKEN`, and `UNDERWRITER_SESSION_SECRET` must
  never use a `NEXT_PUBLIC_` prefix.
- The media token should be fine-grained and limited to one dedicated repository.
- Rotate the underwriter through `setUnderwriter` if compromise is suspected.
- Pause the marketplace if settlement integrity is uncertain.

## Contract controls

- EIP-712 signatures bind every economically relevant mint field.
- Authorization digests are replay-protected.
- ERC-20 operations use `SafeERC20`.
- Trading and liquidity functions use `ReentrancyGuard`.
- Marketplace exchange operations are pausable.
- Asset status is checked during pool access.
- Slippage and deadline parameters are caller-controlled.
- The fee collector and quote asset are immutable per marketplace deployment.

## Known risks

- AI misidentification and valuation error.
- Fraudulent self-attested ownership.
- Manipulated or reused photographs.
- No physical redemption or enforcement layer.
- Low-liquidity price manipulation.
- Fixed fee disproportionately affecting small trades.
- Public exposure or deletion of artifacts stored in the demo media repository.
- Browser event scans becoming slow or incomplete if deployment blocks are
  misconfigured or RPC history is unavailable.
- Admin key compromise.
- Test-token and testnet instability.
- Unaudited smart contracts.

## Incident response

1. Pause the marketplace.
2. Flag affected assets in the registry.
3. Rotate the underwriter if signing integrity is affected.
4. Preserve transaction hashes, logs, signatures, reports, and deployment data.
5. Publish the affected addresses and exact incident window.
6. Deploy a replacement immutable marketplace if collector or token parameters
   must change.

## Evidence and media handling

- The original upload is sent to Gemini for evaluation when live AI is enabled.
- The metadata pipeline does not publish the original upload by default.
- Generated twins and sanitized reports may be publicly readable in the demo
  media repository; users must still avoid confidential source material.
- Evaluation tokens expire after 30 minutes and are bound to the canonical
  report hash. The reference UI exposes two image-generation attempt numbers.
- Each returned twin has a separate HMAC approval bound to its report hash,
  content hash, URI, attempt number, and evaluation expiry. The metadata route
  rejects browser-substituted image records.
- GitHub commit pinning prevents references from silently following branch
  changes, but it does not provide decentralized permanence or censorship
  resistance.
