# Deployment and Operations

## Pre-deployment checklist

- Confirm X Layer testnet chain ID `1952`.
- Confirm USDC_TEST has six decimals.
- Confirm registry underwriter address matches the server signer.
- Confirm fee collector address.
- Confirm deployer has testnet OKB.
- Confirm `GEMINI_API_KEY`, `UNDERWRITER_PRIVATE_KEY`, and
  `UNDERWRITER_SESSION_SECRET` are server-only variables.
- Confirm the media token has access only to the dedicated demo media repository.
- Set deployment-block variables close to contract creation blocks so browser
  event scans do not start at genesis.
- Run typecheck, compile, tests, build, and `git diff --check`.
- Confirm no environment file or generated credential is tracked.

## Marketplace-only migration

The physical-asset pivot does not change the registry storage or mint signature
shape. A fee-aware marketplace can therefore be deployed against the current
registry without migrating existing token IDs.

Deployment constructor parameters:

```text
RWA registry address
USDC_TEST address
fee collector address
```

After deployment:

1. Verify bytecode.
2. Read `rwa()`, `usdc()`, `feeCollector()`, `MIN_SEED_USDC()`, and
   `PLATFORM_FEE_USDC()`.
3. Update `NEXT_PUBLIC_MARKETPLACE_ADDRESS` locally and in Vercel.
4. Rebuild and deploy the web application.
5. Perform a listing-fee smoke test before wider use.

Current X Layer testnet fee-aware marketplace:

```text
0x84e6C8412D48b9d8469705d56541C5Fd39b18f36
```

## Production verification

- `/`, `/tokenize`, `/dashboard`, `/marketplace`, and a market detail route
  return successful responses.
- An unrelated/non-physical upload is rejected.
- A clear physical-item photo can reach an approved or manual-review decision.
- Listing approval includes 10.20 USDC for a 10 USDC seed.
- Fee collector receives exactly 0.20 USDC per listing, buy, and sell.
- Pool reserves exclude platform revenue.
- Mint confirmation redirects to the guided listing flow.
- `/dashboard` finds issuer assets, live markets, and fractional holdings from
  registry, transfer, and pool events.
- Generated media URLs are commit-pinned and readable without credentials.

## Demo media storage

Set `GITHUB_MEDIA_TOKEN`, `GITHUB_MEDIA_REPO`, and `GITHUB_MEDIA_BRANCH` in
Vercel. Use a fine-grained token limited to contents write access on a dedicated
media repository. The app writes generated WebP twins, sanitized reports, and
ERC-1155 metadata; it does not publish the original user upload.

If the integration is absent, the API returns data URIs. This is useful for
local testing but is not a production persistence strategy. GitHub storage is
also a demo compromise: migrate to immutable content-addressed storage before
mainnet.

## Release checks

```bash
npx tsc --noEmit
npm run test:unit
npm run test:contract
npm run build
git diff --check
```

A full mint/list/buy/sell smoke test requires browser-wallet signatures,
USDC_TEST, and testnet OKB.
