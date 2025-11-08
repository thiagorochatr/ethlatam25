"use client";

import { useState, useMemo, useEffect } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useVestingWallet } from "~~/hooks/vesting/useVestingWallet";
import { useCustomVestingFactory } from "~~/hooks/vesting/useCustomVestingFactory";

/**
 * Beneficiary Panel for Viewing and Claiming Vested Tokens
 * Allows beneficiaries to check their vesting schedule and claim available tokens
 */
export default function BeneficiaryPanel() {
  const { address: userAddress, isConnected, chain } = useAccount();
  const chainId = chain?.id;

  // Token mode selection
  const [tokenMode, setTokenMode] = useState<"testing" | "production">("testing");

  // Pre-configured addresses from deployment
  const factoryAddress = "0xaF8aB08B63359cf8Ae8CFA9E1209CD96626fd55A";
  
  const TOKEN_ADDRESSES = {
    testing: "0x68A9c737bf73D5442a69946816E405dFA4C06e33", // SimpleMockToken
    production: "0x01D32cDfAa2787c9729956bDaF8D378ebDC9aa12", // ConfidentialVestingToken (Full FHE)
  };
  
  const tokenAddress = TOKEN_ADDRESSES[tokenMode];
  
  // Vesting wallet address (discovered by user)
  const [vestingWalletAddress, setVestingWalletAddress] = useState("");

  // Schedule parameters (to find the wallet)
  const [startTimestamp, setStartTimestamp] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(300);
  const [cliffSeconds, setCliffSeconds] = useState(120);

  // FHEVM instance
  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const initialMockChains = { 31337: "http://localhost:8545" };

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  // Factory hook to find vesting wallet
  const { getVestingWalletAddress } = useCustomVestingFactory({
    factoryAddress,
    instance: fhevmInstance,
  });

  // Vesting wallet hook
  const { owner, releasableAmount, releaseTokens, getReleasableAmount, isProcessing, isDecrypting, message } =
    useVestingWallet({
      walletAddress: vestingWalletAddress,
      instance: fhevmInstance,
    });

  // Find vesting wallet for the current user
  const findMyWallet = async () => {
    if (!userAddress) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      const address = await getVestingWalletAddress(
        userAddress,
        startTimestamp || Math.floor(Date.now() / 1000) - 3600, // Default to 1 hour ago
        durationSeconds,
        cliffSeconds,
      );
      setVestingWalletAddress(address);
    } catch (error) {
      console.error("Error finding wallet:", error);
      alert("Failed to find vesting wallet. Please check the cliff and duration parameters match what the admin set.");
    }
  };

  // Check releasable amount
  const checkReleasable = async () => {
    await getReleasableAmount(tokenAddress);
  };

  // Claim tokens
  const handleClaim = async () => {
    try {
      await releaseTokens(tokenAddress);
    } catch (error) {
      console.error("Failed to release tokens:", error);
    }
  };

  const buttonClass =
    "inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg " +
    "transition-all duration-200 hover:scale-105 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

  const primaryButtonClass =
    buttonClass + " bg-[#FFD208] text-[#2D2D2D] hover:bg-[#A38025] focus-visible:ring-[#2D2D2D] cursor-pointer";

  const secondaryButtonClass =
    buttonClass + " bg-black text-[#F4F4F4] hover:bg-[#1F1F1F] focus-visible:ring-[#FFD208] cursor-pointer";

  const inputClass =
    "w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FFD208] focus:border-transparent text-gray-900 bg-white";

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-gray-900">
        <div className="flex items-center justify-center">
          <div className="bg-white shadow-xl p-8 text-center">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Wallet not connected</h2>
            <p className="text-gray-700 mb-6">Connect your wallet to check your vesting schedule.</p>
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">🎁 Beneficiary Portal</h1>
        <p className="text-gray-600">View and claim your vested tokens</p>
      </div>

      {/* Configuration */}
      <div className="bg-white shadow-lg p-6">
        <h3 className="font-bold text-gray-900 text-xl mb-4">⚙️ Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Address (Connected)</label>
            <input type="text" className={inputClass + " bg-blue-50 text-gray-900"} value={userAddress || ""} disabled />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Factory Address</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className={inputClass + " bg-gray-50 text-gray-900"}
                value={factoryAddress}
                readOnly
              />
              <a
                href={`https://sepolia.etherscan.io/address/${factoryAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm whitespace-nowrap"
              >
                View →
              </a>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Token Mode</label>
            <select
              value={tokenMode}
              onChange={(e) => setTokenMode(e.target.value as "testing" | "production")}
              className={inputClass + " cursor-pointer text-gray-900"}
            >
              <option value="testing">🧪 Testing (SimpleMockToken - Easy minting)</option>
              <option value="production">🔒 Production (Full FHE Encryption - Requires proof)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {tokenMode === "testing" 
                ? "Testing mode: Uses simple mock token for easy testing" 
                : "Production mode: Uses full FHE encryption with proof generation"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Address {tokenMode === "testing" ? "(SimpleMockToken)" : "(ConfidentialVestingToken)"}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className={inputClass + " bg-gray-50 text-gray-900"}
                value={tokenAddress}
                readOnly
              />
              <a
                href={`https://sepolia.etherscan.io/address/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm whitespace-nowrap"
              >
                View →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Find Your Wallet */}
      <div className="bg-white shadow-lg p-6">
        <h3 className="font-bold text-gray-900 text-xl mb-4">🔍 Find Your Vesting Wallet</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliff (seconds)</label>
              <input
                type="number"
                className={inputClass + " text-gray-900"}
                value={cliffSeconds}
                onChange={e => setCliffSeconds(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
              <input
                type="number"
                className={inputClass + " text-gray-900"}
                value={durationSeconds}
                onChange={e => setDurationSeconds(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Timestamp (optional)</label>
              <input
                type="number"
                className={inputClass + " text-gray-900"}
                value={startTimestamp || ""}
                onChange={e => setStartTimestamp(parseInt(e.target.value) || 0)}
                placeholder="Leave empty for auto"
              />
            </div>
          </div>

          <button onClick={findMyWallet} className={secondaryButtonClass + " w-full"}>
            🔍 Find My Vesting Wallet
          </button>

          {vestingWalletAddress && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-sm font-medium text-green-900 mb-1">✅ Vesting Wallet Found:</p>
              <p className="font-mono text-xs text-green-800 break-all">{vestingWalletAddress}</p>
              {owner && (
                <p className="text-sm text-green-700 mt-2">
                  <strong>Owner:</strong> {owner}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Vesting Info & Actions */}
      {vestingWalletAddress && (
        <div className="bg-white shadow-lg p-6">
          <h3 className="font-bold text-gray-900 text-xl mb-4">💰 Your Vesting</h3>

          <div className="space-y-4">
            {/* Releasable Amount Display */}
            {releasableAmount !== null && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="text-lg font-semibold text-blue-900">
                  Releasable Amount: {releasableAmount.toString()} tokens
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={checkReleasable}
                disabled={!vestingWalletAddress || !tokenAddress || isDecrypting}
                className={secondaryButtonClass + " w-full"}
              >
                {isDecrypting ? "⏳ Decrypting..." : "🔓 Check Releasable Amount"}
              </button>

              <button
                onClick={handleClaim}
                disabled={!vestingWalletAddress || !tokenAddress || isProcessing || releasableAmount === BigInt(0)}
                className={primaryButtonClass + " w-full"}
              >
                {isProcessing ? "⏳ Processing..." : "🎉 Claim Tokens"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {message && (
        <div className="bg-white shadow-lg p-6">
          <h3 className="font-bold text-gray-900 text-xl mb-4">💬 Status</h3>
          <p className="text-gray-800">{message}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
        <h3 className="font-bold text-blue-900 text-lg mb-3">📖 Instructions</h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
          <li>Connect your wallet (must be the beneficiary address)</li>
          <li>Enter the factory address (get from admin)</li>
          <li>Enter the token address</li>
          <li>Enter the vesting parameters (cliff & duration from admin)</li>
          <li>Click "Find My Vesting Wallet" to locate your wallet</li>
          <li>Click "Check Releasable Amount" to see how much you can claim</li>
          <li>Wait for the cliff period (2 min) to pass</li>
          <li>Click "Claim Tokens" to release your vested tokens!</li>
        </ol>
      </div>
    </div>
  );
}

