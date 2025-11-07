// Configuration for ZK App
// Update this file after deploying your contracts

export const config = {
  // Contract addresses (update after deployment)
  contracts: {
    zkMint: process.env.NEXT_PUBLIC_ZK_CONTRACT_ADDRESS || "",
  },

  // Network configuration
  network: {
    chainId: 421614, // Arbitrum Sepolia
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
  },

  // Supported tokens for ZK proofs (optional restriction)
  supportedTokens: process.env.SUPPORTED_TOKENS?.split(',') || [
    // Add default token addresses here or leave empty for any token
    // "0x...", // Example: USDC on Arbitrum Sepolia
  ],
} as const;

// Validation
if (config.contracts.zkMint === "0x...") {
  console.warn("⚠️  ZK contract address not set. Deploy contracts and update lib/config.ts");
}