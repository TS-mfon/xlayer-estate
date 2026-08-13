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
3. POST report, token, recipient, and optional image to `/api/metadata`.
4. Submit returned fields to `tokenizeProperty`.
5. Decode `AssetTokenized` to obtain token ID.

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

Resolve `ipfs://CID/path` through a trusted gateway. Data URIs can be fetched
directly. Consumers should display the self-attested ownership warning and must
not relabel an asset as legally verified.
