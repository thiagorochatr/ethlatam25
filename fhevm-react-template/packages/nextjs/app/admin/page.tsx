"use client";

import { useState, useMemo } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useCustomVestingFactory, type VestingSchedule } from "~~/hooks/vesting/useCustomVestingFactory";

/**
 * Admin Panel for Creating and Funding Vesting Schedules
 * Allows admins to batch create encrypted vesting wallets for multiple beneficiaries
 */
export default function AdminPanel() {
  const { isConnected, chain } = useAccount();
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

  // Vesting schedules
  const [schedules, setSchedules] = useState<VestingSchedule[]>([
    {
      beneficiary: "",
      amount: BigInt(0),
      startTimestamp: Math.floor(Date.now() / 1000), // Now
      durationSeconds: 300, // 5 minutes
      cliffSeconds: 120, // 2 minutes
    },
  ]);

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

  // Custom vesting factory hook
  const { batchCreateAndFund, isProcessing, message, txHash } = useCustomVestingFactory({
    factoryAddress,
    instance: fhevmInstance,
  });

  // Add a new schedule to the list
  const addSchedule = () => {
    setSchedules([
      ...schedules,
      {
        beneficiary: "",
        amount: BigInt(0),
        startTimestamp: Math.floor(Date.now() / 1000),
        durationSeconds: 300,
        cliffSeconds: 120,
      },
    ]);
  };

  // Remove a schedule from the list
  const removeSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  // Update a schedule
  const updateSchedule = (index: number, field: keyof VestingSchedule, value: string | number) => {
    const newSchedules = [...schedules];
    if (field === "amount") {
      newSchedules[index][field] = BigInt(value || 0);
    } else if (field === "beneficiary") {
      newSchedules[index][field] = value as string;
    } else {
      newSchedules[index][field] = typeof value === "string" ? parseInt(value) || 0 : value;
    }
    setSchedules(newSchedules);
  };

  // Submit the batch
  const handleSubmit = async () => {
    const validSchedules = schedules.filter(s => s.beneficiary && s.amount > 0);
    if (validSchedules.length === 0) {
      alert("Please add at least one valid schedule with beneficiary address and amount");
      return;
    }

    try {
      await batchCreateAndFund(tokenAddress, validSchedules);
    } catch (error) {
      console.error("Failed to create vesting schedules:", error);
    }
  };

  const buttonClass =
    "inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg " +
    "transition-all duration-200 hover:scale-105 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

  const primaryButtonClass =
    buttonClass + " bg-[#FFD208] text-[#2D2D2D] hover:bg-[#A38025] focus-visible:ring-[#2D2D2D] cursor-pointer";

  const dangerButtonClass =
    buttonClass + " bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 cursor-pointer";

  const inputClass =
    "w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FFD208] focus:border-transparent text-gray-900 bg-white";

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-gray-900">
        <div className="flex items-center justify-center">
          <div className="bg-white shadow-xl p-8 text-center">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Wallet not connected</h2>
            <p className="text-gray-700 mb-6">Connect your wallet to access the admin panel.</p>
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">🔐 Vesting Admin Panel</h1>
        <p className="text-gray-600">Create and fund encrypted vesting schedules</p>
      </div>

      {/* Configuration - Pre-configured */}
      <div className="bg-white shadow-lg p-6 mb-6">
        <h3 className="font-bold text-gray-900 text-xl mb-4">⚙️ Configuration</h3>
        <div className="space-y-4">
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

      {/* Vesting Schedules */}
      <div className="bg-white shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 text-xl">📋 Vesting Schedules</h3>
          <button onClick={addSchedule} className={primaryButtonClass}>
            ➕ Add Schedule
          </button>
        </div>

        <div className="space-y-4">
          {schedules.map((schedule, index) => (
            <div key={index} className="border border-gray-300 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-800">Schedule #{index + 1}</h4>
                {schedules.length > 1 && (
                  <button onClick={() => removeSchedule(index)} className="text-red-600 hover:text-red-800">
                    🗑️ Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary Address</label>
                  <input
                    type="text"
                    className={inputClass + " text-gray-900"}
                    placeholder="0x..."
                    value={schedule.beneficiary}
                    onChange={e => updateSchedule(index, "beneficiary", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (tokens)</label>
                  <input
                    type="number"
                    className={inputClass + " text-gray-900"}
                    placeholder="1000"
                    value={schedule.amount.toString()}
                    onChange={e => updateSchedule(index, "amount", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliff (seconds)</label>
                  <input
                    type="number"
                    className={inputClass + " text-gray-900"}
                    placeholder="120"
                    value={schedule.cliffSeconds}
                    onChange={e => updateSchedule(index, "cliffSeconds", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Demo: 120 seconds = 2 minutes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
                  <input
                    type="number"
                    className={inputClass + " text-gray-900"}
                    placeholder="300"
                    value={schedule.durationSeconds}
                    onChange={e => updateSchedule(index, "durationSeconds", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Demo: 300 seconds = 5 minutes</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className={primaryButtonClass + " w-full"}
          >
            {isProcessing ? "⏳ Processing..." : "🚀 Create & Fund Vesting Schedules"}
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <div className="bg-white shadow-lg p-6">
          <h3 className="font-bold text-gray-900 text-xl mb-4">💬 Status</h3>
          <p className="text-gray-800 mb-2">{message}</p>
          {txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              View on Etherscan →
            </a>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
        <h3 className="font-bold text-blue-900 text-lg mb-3">📖 Instructions</h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
          <li>Deploy the CustomVestingFactory contract and enter its address above</li>
          <li>Deploy an ERC7984 compatible token and enter its address</li>
          <li>Approve the factory to spend your tokens</li>
          <li>Add beneficiary addresses and amounts (will be encrypted!)</li>
          <li>Set cliff (2 min) and duration (5 min) for demo purposes</li>
          <li>Click "Create & Fund" to batch create vesting wallets</li>
          <li>Share wallet addresses with beneficiaries so they can claim</li>
        </ol>
      </div>
    </div>
  );
}

