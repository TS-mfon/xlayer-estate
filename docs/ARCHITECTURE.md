# Architecture

## Components

```text
Browser wallet
  │
  ├─ upload ───────────────→ Next.js /api/underwrite
  │                            │
  │                            └─ Gemini structured evaluation
  │
  ├─ approved report ──────→ Next.js /api/metadata
  │                            ├─ report and metadata hashing
  │                            ├─ optional Pinata persistence
  │                            └─ EIP-712 underwriter signature
  │
  ├─ signed mint ──────────→ RWAAsset (ERC-1155 registry)
  │
  └─ list / buy / sell ────→ RWAAMMMarketplace
                               ├─ RWAAsset shares
                               ├─ USDC_TEST reserves
                               └─ fixed fee collector
```

## Trust boundaries

- The browser is untrusted and cannot create an accepted mint authorization.
- Gemini output is advisory and must pass deterministic normalization and
  threshold logic before signing.
- The underwriter server is trusted to enforce policy and protect its key.
- The issuer's ownership claim is not verified by the protocol.
- The contracts are authoritative for token supply, status, reserves, fees, and
  settlement.
- IPFS gateways and RPC providers are availability dependencies, not sources of
  protocol authorization.

## Data placement

| Data | Placement |
|---|---|
| Asset image | IPFS or data URI |
| Structured report | IPFS or data URI |
| Report hash | Registry contract |
| Metadata hash and URI | Registry contract |
| Valuation, risk, supply, issuer, status | Registry contract |
| Pool reserves and LP accounting | Marketplace contract |
| Gemini key and signer key | Server environment only |
| Deployer key | Deployment environment only |

## Failure behavior

- Gemini unavailable: image/PDF inputs move to manual review; no mint signature.
- Invalid evaluation token: metadata endpoint returns `403`.
- Expired/replayed/forged signature: registry transaction reverts.
- Wrong network: frontend requests X Layer testnet switch.
- Missing allowance/operator approval: frontend exposes approval transaction.
- RPC or wallet rejection: frontend preserves state and reports the error.
- Inactive asset: marketplace trading reverts.
