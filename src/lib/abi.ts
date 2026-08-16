export const rwaAbi = [
  { type: "event", name: "TransferSingle", anonymous: false, inputs: [{ name: "operator", type: "address", indexed: true }, { name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "id", type: "uint256", indexed: false }, { name: "value", type: "uint256", indexed: false }] },
  { type: "event", name: "TransferBatch", anonymous: false, inputs: [{ name: "operator", type: "address", indexed: true }, { name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "ids", type: "uint256[]", indexed: false }, { name: "values", type: "uint256[]", indexed: false }] },
  { type: "event", name: "AssetTokenized", anonymous: false, inputs: [
    { name: "tokenId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "valuationUsd", type: "uint256", indexed: false }, { name: "launchValuationUsd", type: "uint256", indexed: false }, { name: "riskScore", type: "uint8", indexed: false }, { name: "underwritingHash", type: "bytes32", indexed: false }, { name: "metadataHash", type: "bytes32", indexed: false }, { name: "metadataURI", type: "string", indexed: false },
  ] },
  { type: "function", name: "tokenizeProperty", stateMutability: "nonpayable", inputs: [
    { name: "to", type: "address" }, { name: "valuationUsd", type: "uint256" }, { name: "launchValuationUsd", type: "uint256" }, { name: "riskScore", type: "uint8" }, { name: "underwritingHash", type: "bytes32" }, { name: "metadataHash", type: "bytes32" }, { name: "metadataURI", type: "string" }, { name: "totalShares", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }, { name: "signature", type: "bytes" },
  ], outputs: [{ name: "tokenId", type: "uint256" }] },
  { type: "function", name: "assetInfo", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "info", type: "tuple", components: [
    { name: "owner", type: "address" }, { name: "valuationUsd", type: "uint256" }, { name: "launchValuationUsd", type: "uint256" }, { name: "totalShares", type: "uint256" }, { name: "riskScore", type: "uint8" }, { name: "status", type: "uint8" }, { name: "underwritingHash", type: "bytes32" }, { name: "metadataHash", type: "bytes32" }, { name: "metadataURI", type: "string" }, { name: "timestamp", type: "uint64" },
  ] }] },
  { type: "function", name: "getAssetMarketData", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "owner", type: "address" }, { name: "launchValuationUsd", type: "uint256" }, { name: "totalShares", type: "uint256" }, { name: "status", type: "uint8" }] },
  { type: "function", name: "uri", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "setStatus", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }, { name: "newStatus", type: "uint8" }], outputs: [] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }, { name: "id", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOfBatch", stateMutability: "view", inputs: [{ name: "accounts", type: "address[]" }, { name: "ids", type: "uint256[]" }], outputs: [{ name: "", type: "uint256[]" }] },
  { type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
  { type: "function", name: "isApprovedForAll", stateMutability: "view", inputs: [{ name: "account", type: "address" }, { name: "operator", type: "address" }], outputs: [{ name: "", type: "bool" }] },
] as const;

export const marketplaceAbi = [
  { type: "event", name: "PoolCreated", anonymous: false, inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "creator", type: "address", indexed: true }, { name: "shares", type: "uint256", indexed: false }, { name: "usdc", type: "uint256", indexed: false }, { name: "lockedLiquidity", type: "uint256", indexed: false }] },
  { type: "event", name: "SharesPurchased", anonymous: false, inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true }, { name: "usdcIn", type: "uint256", indexed: false }, { name: "sharesOut", type: "uint256", indexed: false }, { name: "fee", type: "uint256", indexed: false }] },
  { type: "event", name: "SharesSold", anonymous: false, inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "sharesIn", type: "uint256", indexed: false }, { name: "usdcOut", type: "uint256", indexed: false }, { name: "fee", type: "uint256", indexed: false }] },
  { type: "function", name: "MIN_SEED_USDC", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "PLATFORM_FEE_USDC", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "feeCollector", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "createPool", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }, { name: "usdcAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "buy", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }, { name: "usdcIn", type: "uint256" }, { name: "minSharesOut", type: "uint256" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "sharesOut", type: "uint256" }] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }, { name: "sharesIn", type: "uint256" }, { name: "minUsdcOut", type: "uint256" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "usdcOut", type: "uint256" }] },
  { type: "function", name: "quoteBuy", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }, { name: "usdcIn", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "quoteSell", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }, { name: "sharesIn", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "pools", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "shareReserve", type: "uint256" }, { name: "usdcReserve", type: "uint256" }, { name: "totalLiquidity", type: "uint256" }, { name: "lockedLiquidity", type: "uint256" }, { name: "active", type: "bool" }] },
  { type: "function", name: "liquidityOf", stateMutability: "view", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "addLiquidity", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }, { name: "shareAmount", type: "uint256" }, { name: "usdcAmount", type: "uint256" }, { name: "minLiquidity", type: "uint256" }], outputs: [{ name: "liquidity", type: "uint256" }] },
  { type: "function", name: "removeLiquidity", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }, { name: "liquidity", type: "uint256" }, { name: "minShares", type: "uint256" }, { name: "minUsdc", type: "uint256" }], outputs: [{ name: "shares", type: "uint256" }, { name: "usdcAmount", type: "uint256" }] },
] as const;

export const erc20Abi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;
