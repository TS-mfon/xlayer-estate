# XLayer Estate Protocol Specification

## 1. Scope

XLayer Estate is a testnet protocol for creating AI-assisted records of tangible
assets, issuing fungible fractional units as ERC-1155 tokens, and launching
USDC-denominated markets for those units on X Layer.

The protocol separates four concerns:

1. evidence interpretation and conservative valuation;
2. authorization of asset issuance;
3. on-chain asset registration and fractional issuance;
4. liquidity creation and secondary exchange.

The protocol does not establish legal title, custody, possession, authenticity,
insurance, redemption, delivery, or enforceability against a physical object.
An issuer's ownership claim is self-attested unless an independent off-chain
process is added by a future integrator.

## 2. Participants

- **Issuer** — uploads asset evidence, receives an authorization, mints shares,
  and may initialize a market.
- **Underwriter service** — evaluates evidence and signs mint authorizations.
- **Underwriter signer** — EOA whose address is configured in `RWAAsset`.
- **Liquidity provider** — contributes proportional ERC-1155 shares and USDC.
- **Trader** — buys or sells shares against an active pool.
- **Registry owner** — may rotate the underwriter and change asset status.
- **Marketplace owner** — may pause or unpause exchange operations.
- **Fee collector** — immutable recipient of fixed platform fees.

## 3. Protocol objects

### 3.1 Asset report

A canonical report contains:

- asset name and category;
- visible brand and model;
- visible condition and non-sensitive identifier;
- self-attested ownership statement;
- evidence and authenticity scores;
- valuation point estimate and range;
- launch valuation;
- confidence, risk score, and risk flags;
- decision and mint-eligibility state.

The canonical JSON is hashed with `keccak256`. The raw report does not need to be
stored on-chain.

### 3.2 Asset token

Each approved asset receives one ERC-1155 token ID and a fixed initial supply of
`1,000,000` units. Units are divisible ownership-accounting primitives within
the protocol; they are not legal title certificates.

### 3.3 Pool

Each token ID may have at most one marketplace pool. A pool tracks share
reserve, USDC reserve, total liquidity, permanently locked liquidity, and active
state.

## 4. Issuance state machine

```text
UPLOAD
  → REJECTED
  → MANUAL_REVIEW
  → APPROVED
       → AUTHORIZED
       → MINTED
       → LISTED
       → ACTIVE / FLAGGED / RETIRED
```

- `REJECTED` and `MANUAL_REVIEW` reports cannot receive a mint signature.
- `APPROVED` reports are bound to a recipient, valuation, hashes, supply, nonce,
  and deadline.
- `MINTED` assets receive status `1` (`Active`) by default.
- Trading requires both an active pool and registry status `1`.
- The registry owner or asset issuer can change status within the allowed enum.

## 5. Underwriting policy

The evidence gate accepts recognizable lawful physical objects. A clear photo
may be sufficient to identify existence and visible condition. Private identity
or ownership paperwork is not required.

The gate rejects or escalates:

- non-physical subjects and screenshots without a visible asset;
- prohibited or illegal goods;
- weapons;
- obviously generated, manipulated, contradictory, or unrecognizable evidence;
- files whose valuation cannot be estimated with minimum confidence.

Valuation is a conservative second-hand USD estimate. The launch valuation is
the lower bound of the valuation range. The model must not invent a serial
number, brand, model, provenance, owner, or custody relationship.

## 6. Mint authorization

`RWAAsset` uses EIP-712 domain:

```text
name: XLayerEstate
version: 2
chainId: 1952
verifyingContract: deployed registry address
```

The signed `MintAuthorization` binds:

- recipient;
- valuation and launch valuation;
- risk score;
- report and metadata hashes;
- total shares;
- nonce;
- deadline.

A recovered signer must equal the configured underwriter. Each authorization
digest is single-use. Expired authorizations revert.

## 7. Market initialization

Only the recorded issuer may create a pool. Requirements:

- asset status is active;
- no pool exists for the token ID;
- seed is at least `10,000,000` raw USDC units (`10.00 USDC`);
- marketplace has ERC-1155 operator approval;
- marketplace allowance covers seed plus `200,000` raw units (`0.20 USDC`).

Matching shares are derived from launch valuation:

```text
shares = seedUSDC × totalShares / (launchValuationUSD × 10^6)
```

If this exceeds total supply for a low-value asset, the pool uses the full
supply. This produces a 10 USDC minimum market capitalization without changing
the stored AI valuation.

The full seed enters the pool. The listing fee is transferred separately. LP
units representing the first 10 USDC are permanently locked.

## 8. Trading

### 8.1 AMM fee

The protocol retains a `0.30%` liquidity-provider fee inside the pool through
the constant-product pricing calculation.

### 8.2 Platform fee

A fixed `0.20 USDC` platform fee applies to:

- pool creation;
- every buy;
- every sell.

The collector is immutable in the marketplace deployment.

### 8.3 Buy

The user supplies a total USDC input. The fixed platform fee is removed first.
The remaining pool input is priced with the AMM fee, shares are transferred to
the buyer, and the complete non-platform input becomes pool reserve.

### 8.4 Sell

Shares are priced using the AMM fee. The fixed platform fee is deducted from
gross USDC output. The trader receives net output. Trades whose gross output
cannot cover the fixed fee revert.

### 8.5 Protections

- caller-specified minimum output;
- transaction deadline;
- reentrancy guard;
- marketplace pause switch;
- registry asset-status check;
- safe ERC-20 and ERC-1155 transfers.

## 9. Metadata and provenance

NFT metadata contains an image, report URI, report hash, conservative valuation,
risk, category, condition, evidence score, authenticity score, and an explicit
self-attested ownership attribute.

The original source is evaluated but is not published by the metadata pipeline.
An approved evaluation can generate at most two asset-twin candidates. The
selected twin, sanitized report, and metadata are stored in a dedicated GitHub
demo media repository when configured; immutable references use the commit SHA.
Without that integration, the demonstration uses content-addressed data URIs and
does not rely on Vercel's ephemeral filesystem.

GitHub is a hackathon persistence layer, not protocol-grade decentralized or
permanent storage. A production release should migrate immutable artifacts to a
content-addressed storage network while preserving the on-chain hashes.

## 10. Compatibility

The deployed registry retains the historical function name
`tokenizeProperty`. Its parameters are generic and the protocol now uses it for
all supported tangible assets. Renaming it would require a registry migration
and is therefore deferred to a future major version.
