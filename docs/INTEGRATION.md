# Integration Guide

## Read operations

Integrators need the registry ABI, marketplace ABI, X Layer testnet chain ID
`1952`, and deployed addresses.

Registry reads:

- `totalAssets()`
- `assetInfo(tokenId)`
- `uri(tokenId)`
- `balanceOf(account, tokenId)`
- `getAssetMarketData(tokenId)`

Marketplace reads:

- `pools(tokenId)`
- `liquidityOf(tokenId, account)`
- `quoteBuy(tokenId, totalUsdcInput)`
- `quoteSell(tokenId, sharesInput)`
- `MIN_SEED_USDC()`
- `PLATFORM_FEE_USDC()`
- `feeCollector()`

## Write sequence

### Mint

1. POST evidence to `/api/underwrite`.
2. Require `decision === "approved"`, `mintEligible === true`, and an
   `evaluationToken`.
3. POST the report, token, and attempt number to `/api/generate-image`.
4. Let the user review the generated twin. One regeneration is available because
   every evaluation allows at most two image attempts.
5. POST the report, evaluation token, recipient, returned image record, and
   returned `imageToken` to `/api/metadata`. The image token prevents the
   browser from substituting an unrelated image before mint authorization.
6. Submit returned fields to `tokenizeProperty`.
7. Decode `AssetTokenized`, then route directly to the guided listing flow.

### List

1. Read issuer from `assetInfo`.
2. Call `setApprovalForAll(marketplace, true)`.
3. Approve `seed + PLATFORM_FEE_USDC` on USDC_TEST.
4. Call `createPool(tokenId, seed)`.

### Buy

1. Treat the user's entered amount as total cost including the fixed fee.
2. Read `quoteBuy(tokenId, totalInput)`.
3. Approve total input.
4. Call `buy` with a minimum share output and deadline.

### Sell

1. Read `quoteSell`; it returns net USDC after the fixed fee.
2. Approve the marketplace as ERC-1155 operator.
3. Call `sell` with minimum net USDC and deadline.

## Metadata

Generated images, reports, and metadata may use commit-pinned GitHub raw URLs or
data URIs. Consumers should verify the on-chain metadata/report hashes, display
the self-attested ownership warning, and must not relabel an asset as legally
verified.

## Portfolio indexing

The reference client discovers wallet assets without a centralized indexer. It
scans configurable deployment-block ranges in RPC-safe chunks, combines registry
mint events with ERC-1155 transfers, reads current balances, and joins
marketplace `PoolCreated` events. Production integrators should use a dedicated
indexer when asset volume makes browser scans expensive.
