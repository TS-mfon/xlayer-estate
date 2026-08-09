export const rwaAbi = [
  {
    type: "function",
    name: "tokenizeProperty",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "valuationUsd", type: "uint256" },
      { name: "riskScore", type: "uint8" },
      { name: "underwritingHash", type: "bytes32" },
      { name: "metadataURI", type: "string" },
      { name: "totalShares", type: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "assetInfo",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      {
        name: "info",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "valuationUsd", type: "uint256" },
          { name: "riskScore", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "underwritingHash", type: "bytes32" },
          { name: "metadataURI", type: "string" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "uri",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setStatus",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newStatus", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
