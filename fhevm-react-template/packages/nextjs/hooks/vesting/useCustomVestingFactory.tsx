"use client";

import { useCallback, useState } from "react";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import type { FhevmInstance } from "@fhevm-sdk";
import { CustomVestingFactoryABI } from "../../contracts/vestingContracts";
import { ethers } from "ethers";

export interface VestingSchedule {
  beneficiary: string;
  amount: bigint; // Clear amount (will be encrypted)
  startTimestamp: number;
  durationSeconds: number;
  cliffSeconds: number;
}

interface UseCustomVestingFactoryParams {
  factoryAddress: string;
  instance: FhevmInstance | undefined;
}

/**
 * Hook for interacting with the CustomVestingFactory contract
 * Provides methods to create and fund vesting schedules with encrypted amounts
 */
export const useCustomVestingFactory = ({ factoryAddress, instance }: UseCustomVestingFactoryParams) => {
  const { ethersSigner } = useWagmiEthers();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  /**
   * Batch create and fund vesting wallets with encrypted amounts
   */
  const batchCreateAndFund = useCallback(
    async (tokenAddress: string, schedules: VestingSchedule[]) => {
      if (!ethersSigner || !instance) {
        setMessage("❌ Wallet not connected or FHE instance not ready");
        return;
      }

      if (!factoryAddress || factoryAddress === "") {
        setMessage("❌ Factory address not configured");
        return;
      }

      if (!tokenAddress || tokenAddress === "") {
        setMessage("❌ Please select a token mode first");
        return;
      }

      try {
        setIsProcessing(true);
        setMessage("🔄 Checking token approval...");

        const factory = new ethers.Contract(factoryAddress, CustomVestingFactoryABI, ethersSigner);
        const userAddress = await ethersSigner.getAddress();

        // Check token balance and approval
        const tokenABI = [
          "function isOperator(address account, address operator) view returns (bool)",
          "function balanceOf(address account) view returns (uint256)",
        ];
        const token = new ethers.Contract(tokenAddress, tokenABI, ethersSigner);
        
        // Calculate total amount needed
        const totalAmount = schedules.reduce((sum, s) => sum + s.amount, BigInt(0));
        
        // Check balance
        const balance = await token.balanceOf(userAddress);
        if (balance < totalAmount) {
          setMessage(
            `❌ Insufficient balance! You need ${totalAmount.toString()} tokens but only have ${balance.toString()}. ` +
            `Please mint tokens at: https://sepolia.etherscan.io/address/${tokenAddress}#writeContract`
          );
          setIsProcessing(false);
          return;
        }
        
        // Check approval (should be done via UI button now)
        const isApproved = await token.isOperator(userAddress, factoryAddress);
        if (!isApproved) {
          setMessage("❌ Factory not approved! Please approve the factory first using the approval button above.");
          setIsProcessing(false);
          return;
        }

        setMessage("🔄 Preparing encrypted vesting schedules...");

        // Prepare encrypted schedules
        const encryptedSchedules = [];

        for (const schedule of schedules) {
          // Encrypt the amount using FHE
          // NOTE: euint64 max is ~18 quintillion, which is only ~18 tokens in wei (18 decimals)
          // So we store amounts as whole tokens, not wei
          const amountInTokens = Number(schedule.amount); // User enters tokens, not wei
          
          console.log("🔍 Schedule being processed:", {
            beneficiary: schedule.beneficiary,
            amount: schedule.amount.toString(),
            amountInTokens,
            startTimestamp: schedule.startTimestamp,
            durationSeconds: schedule.durationSeconds,
            cliffSeconds: schedule.cliffSeconds,
          });
          
          if (amountInTokens > 18_000_000_000) { // ~18 billion tokens max for euint64
            throw new Error(`Amount ${amountInTokens} is too large for euint64. Max is ~18 billion tokens.`);
          }
          
          const encryptedAmount = await instance.createEncryptedInput(factoryAddress, await ethersSigner.getAddress());
          encryptedAmount.add64(amountInTokens);
          const { handles, inputProof } = await encryptedAmount.encrypt();

          console.log("🔐 FHE Encryption result:", {
            handle: handles[0],
            inputProofLength: inputProof.length,
            inputProofType: typeof inputProof,
          });

          encryptedSchedules.push({
            beneficiary: schedule.beneficiary,
            encryptedAmount: handles[0], // The encrypted handle
            startTimestamp: schedule.startTimestamp,
            durationSeconds: schedule.durationSeconds,
            cliffSeconds: schedule.cliffSeconds,
          });

          // We'll use the last inputProof (they should all be the same for batch)
          if (encryptedSchedules.length === schedules.length) {
            console.log("📦 Final encrypted schedules:", encryptedSchedules);
            console.log("📝 Token address:", tokenAddress);
            console.log("🔑 Input proof:", inputProof);
            
            setMessage("📝 Sending transaction to create and fund vesting wallets...");

            // Call the contract
            const tx = await factory.batchCreateAndFundVesting(tokenAddress, encryptedSchedules, inputProof);

            setMessage("⏳ Transaction sent! Waiting for confirmation...");
            setTxHash(tx.hash);

            const receipt = await tx.wait();

            setMessage(`✅ Successfully created ${schedules.length} vesting wallet(s)!`);
            setTxHash(receipt.hash);
            setIsProcessing(false);

            return receipt;
          }
        }
      } catch (error: any) {
        console.error("Error creating vesting schedules:", error);
        setMessage(`❌ Error: ${error.message || "Failed to create vesting schedules"}`);
        setIsProcessing(false);
        throw error;
      }
    },
    [ethersSigner, instance, factoryAddress],
  );

  /**
   * Get the predicted address for a vesting wallet
   */
  const getVestingWalletAddress = useCallback(
    async (beneficiary: string, startTimestamp: number, durationSeconds: number, cliffSeconds: number) => {
      if (!ethersSigner) {
        throw new Error("Wallet not connected");
      }

      if (!factoryAddress || factoryAddress === "") {
        throw new Error("Factory address not configured");
      }

      const factory = new ethers.Contract(factoryAddress, CustomVestingFactoryABI, ethersSigner);

      const address = await factory.getVestingWalletAddress(
        beneficiary,
        startTimestamp,
        durationSeconds,
        cliffSeconds,
      );

      return address;
    },
    [ethersSigner, factoryAddress],
  );

  /**
   * Get the vesting implementation address
   */
  const getVestingImplementation = useCallback(async () => {
    if (!ethersSigner) {
      throw new Error("Wallet not connected");
    }

    if (!factoryAddress || factoryAddress === "") {
      throw new Error("Factory address not configured");
    }

    const factory = new ethers.Contract(factoryAddress, CustomVestingFactoryABI, ethersSigner);
    const implementation = await factory.vestingImplementation();

    return implementation;
  }, [ethersSigner, factoryAddress]);

  return {
    batchCreateAndFund,
    getVestingWalletAddress,
    getVestingImplementation,
    isProcessing,
    message,
    txHash,
  };
};

