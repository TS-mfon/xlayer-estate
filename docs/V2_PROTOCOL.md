# XLayer Estate V2 Protocol

V2 is the next protocol layer for XLayer Estate. It is deployed beside the current V1 system and is not a destructive migration of existing testnet assets.

## Authority model

```text
evidence → Gemini observations → deterministic policy → Passport version
                                      ↓
                               signed issuance
                                      ↓
                              ERC-1155 asset shares
                                      ↓
                              isolated bounded market
```

The AI proposes observations. It does not decide which calldata is executable, sign wallet transactions, move funds, change policy, or increase a valuation. Contracts enforce the final state transition.

## Contracts

| Contract | Responsibility |
|---|---|
| `EvidenceRegistryV2` | Content-hashed evidence records and evidence lifecycle |
| `RiskPolicyRegistryV2` | Versioned minimum evidence, confidence, risk, haircut, and impact limits |
| `AssetPassportRegistryV2` | Sequential Passport versions, evidence roots, valuation, risk, status, and expiry |
| `AssetRegistryV2` | EIP-712-gated ERC-1155 issuance bound to a Passport |
| `AssetMarketV2` | Isolated liquidity pools, bounded swaps, LP accounting, and price-impact limits |
| `AgentPolicyGatewayV2` | Only signed, bounded, risk-reducing Passport restrictions |

## Invariants

- Evidence hashes are never replaced; supersession marks an evidence record inactive.
- Passport versions are sequential per `assetId`.
- A Passport cannot be active after expiry.
- A Passport cannot be committed without evidence records and an active policy.
- Issuance requires an active Passport, non-zero metadata, a valid underwriter signature, an unused digest, and a deadline.
- The agent gateway cannot execute arbitrary calldata and has no withdrawal, transfer, trading, valuation, or permission-changing action.
- Pool creation is issuer-only and requires the minimum seed.
- Every market requires an active Passport.
- LPs cannot withdraw below locked liquidity.
- Buy and sell operations enforce minimum output, deadline, reserve, and maximum price-impact checks.
- Financial values are integer quantities; no floating-point values enter contract state.

## Failure behavior

- Gemini failure: no new mint authorization is issued.
- Weak or copied evidence: Passport policy rejects the submission.
- Stale Passport: new issuance and market operations are blocked.
- Forged or replayed authorization: issuance reverts.
- Thin-market trade: price-impact guard reverts.
- Agent payload with an unknown action: proposal validation and contract execution reject it.
- RPC failure: the UI can show cached read data, but it never treats cache data as transaction authority.

## Deployment

Compile and run the V2 deployment script only after reviewing the target network and configured settlement token:

```bash
npm run compile
node scripts/deploy-v2-network.js testnet
```

Mainnet remains intentionally gated:

```bash
CONFIRM_MAINNET_DEPLOY=YES node scripts/deploy-v2-network.js mainnet
```

The script requires `UNDERWRITER_ADDRESS`, `AGENT_ADDRESS`, `PRIVATE_KEY`, and a configured settlement token. It uses one-request RPC transport settings for X Layer testnet providers that reject JSON-RPC batches.
