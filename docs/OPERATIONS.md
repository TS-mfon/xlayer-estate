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

Provision the repository:

```bash
gh auth login -h github.com
gh repo create TS-mfon/xlayer-estate-media \
  --public \
  --add-readme \
  --description "Public generated media and metadata for XLayer Estate testnet assets"
```

Create a fine-grained token scoped only to that repository with **Contents —
Read and write**. Add it directly to Vercel:

```bash
read -rsp "GitHub media token: " GITHUB_MEDIA_TOKEN; echo
printf '%s' "$GITHUB_MEDIA_TOKEN" | \
  npx vercel env add GITHUB_MEDIA_TOKEN production --force --sensitive --yes
unset GITHUB_MEDIA_TOKEN
```

Confirm that `GITHUB_MEDIA_REPO=TS-mfon/xlayer-estate-media` and
`GITHUB_MEDIA_BRANCH=main` exist in the same Vercel environment, then redeploy.
The token must never be added to tracked files, client-side variables,
screenshots, issue comments, or build logs.

If the integration is absent, the API returns data URIs. This is useful for
local testing but is not a production persistence strategy. GitHub storage is
also a demo compromise: migrate to immutable content-addressed storage before
mainnet.

### Twin fallback runbook

Gemini image quota can be zero even when text underwriting remains available.
This condition must not block a valid asset evaluation:

1. `generated`: normalize and store the Gemini image as WebP.
2. `fallback_photo`: remove photo metadata, auto-orient, bound dimensions, and
   store only the derivative.
3. `fallback_svg`: render the deterministic protocol illustration when the
   evidence was not an image.
4. If GitHub storage fails, return compact inline media with a visible warning.
5. Preserve `originalSourcePublished=false` and bind the final image object to
   the evaluation with the image token.

Investigate repeated fallbacks in Function logs under `Gemini twin fallback`.
A `429`, `RESOURCE_EXHAUSTED`, or quota message is a provider quota condition,
not malformed user evidence.

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
