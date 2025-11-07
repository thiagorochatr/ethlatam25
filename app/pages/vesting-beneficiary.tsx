import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain } from "wagmi";
import { arbitrumSepolia, sepolia } from "wagmi/chains";
import styles from "../styles/Home.module.css";
import { NextPage } from "next";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { config } from "../lib/config";
import Link from "next/link";

/**
 * Vesting Beneficiary Page
 * 
 * FASE 1: Release vested tokens
 * 
 * Flow:
 * 1. Beneficiary enters vesting ID
 * 2. View vesting details (public metadata from Arbitrum)
 * 3. Request release on Arbitrum (triggers event)
 * 4. Frontend detects event, switches to Ethereum
 * 5. Call release on Ethereum VestingWallet
 * 6. FHE calculates releasable amount (encrypted!)
 * 7. Tokens transferred to beneficiary
 * 
 * Privacy: totalAmount never revealed, only released amounts
 */
const VestingBeneficiary: NextPage = () => {
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // Form state
  const [vestingId, setVestingId] = useState("");
  const [vestingData, setVestingData] = useState<any>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState<"view" | "request" | "release">("view");
  
  // Ethers providers
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  
  // Check network
  const isArbitrum = chain?.id === arbitrumSepolia.id;
  const isSepolia = chain?.id === sepolia.id;

  // Setup ethers
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const ethersProvider = new ethers.BrowserProvider((window as any).ethereum);
      setProvider(ethersProvider);
      if (address) {
        ethersProvider.getSigner().then(setSigner);
      }
    }
  }, [address]);

  // ========================================================================
  // LOAD VESTING DATA
  // ========================================================================
  
  const loadVestingData = async () => {
    if (!vestingId) {
      setError("Please enter a vesting ID");
      return;
    }

    setIsLoading(true);
    setError("");
    setVestingData(null);

    try {
      console.log("\n🔍 Loading vesting data...");
      console.log("Vesting ID:", vestingId);

      // Contract ABI
      const vestingControllerABI = [
        "function getVesting(uint256 vestingId) external view returns (tuple(address beneficiary, uint64 startTimestamp, uint64 duration, uint64 cliff, bytes32 amountCommitment, bool active, bool initialized))",
        "function isCliffPassed(uint256 vestingId) external view returns (bool)",
        "function getVestingProgress(uint256 vestingId) external view returns (uint256)",
      ];

      // Create provider for Arbitrum
      const arbitrumProvider = new ethers.JsonRpcProvider(config.networks.arbitrum.rpcUrl);
      
      const vestingController = new ethers.Contract(
        config.contracts.vesting.controller,
        vestingControllerABI,
        arbitrumProvider
      );

      // Fetch vesting data
      const vesting = await vestingController.getVesting(vestingId);
      const cliffPassed = await vestingController.isCliffPassed(vestingId);
      const progress = await vestingController.getVestingProgress(vestingId);

      console.log("📊 Vesting Data:");
      console.log("  Beneficiary:", vesting.beneficiary);
      console.log("  Start:", new Date(Number(vesting.startTimestamp) * 1000).toLocaleString());
      console.log("  Duration:", vesting.duration.toString(), "seconds");
      console.log("  Cliff:", vesting.cliff.toString(), "seconds");
      console.log("  Active:", vesting.active);
      console.log("  Cliff Passed:", cliffPassed);
      console.log("  Progress:", progress.toString(), "%");

      // Check if connected wallet is beneficiary
      const isBeneficiary = address && vesting.beneficiary.toLowerCase() === address.toLowerCase();

      setVestingData({
        id: vestingId,
        beneficiary: vesting.beneficiary,
        startTimestamp: Number(vesting.startTimestamp),
        duration: Number(vesting.duration),
        cliff: Number(vesting.cliff),
        amountCommitment: vesting.amountCommitment,
        active: vesting.active,
        initialized: vesting.initialized,
        cliffPassed,
        progress: Number(progress),
        isBeneficiary,
      });

      if (!isBeneficiary) {
        setError("⚠️ You are not the beneficiary of this vesting");
      }

    } catch (err: any) {
      console.error("❌ Error:", err);
      setError(err.message || "Failed to load vesting data");
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // STEP 1: Request Release on Arbitrum
  // ========================================================================
  
  const requestReleaseOnArbitrum = async () => {
    if (!vestingData || !signer) {
      setError("Vesting data not loaded or wallet not connected");
      return;
    }

    if (!isArbitrum) {
      setError("Please switch to Arbitrum Sepolia");
      return;
    }

    if (!vestingData.isBeneficiary) {
      setError("Only beneficiary can request release");
      return;
    }

    if (!vestingData.cliffPassed) {
      setError("Cliff period has not passed yet");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log("\n🚀 Requesting release on Arbitrum...");

      const vestingControllerABI = [
        "function requestRelease(uint256 vestingId) external",
        "event ReleaseRequested(uint256 indexed vestingId, address indexed beneficiary, uint256 timestamp)",
      ];

      const vestingController = new ethers.Contract(
        config.contracts.vesting.controller,
        vestingControllerABI,
        signer
      );

      console.log("📡 Sending transaction...");
      const tx = await vestingController.requestRelease(vestingId);

      console.log("⏳ Waiting for confirmation...");
      console.log("   TX Hash:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✅ Release requested!");

      setStep("release");
      setSuccess("Release requested on Arbitrum! Now release tokens on Ethereum.");

    } catch (err: any) {
      console.error("❌ Error:", err);
      setError(err.message || "Failed to request release");
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // STEP 2: Release Tokens on Ethereum
  // ========================================================================
  
  const releaseTokensOnEthereum = async () => {
    if (!vestingData || !signer) {
      setError("Vesting data not loaded or wallet not connected");
      return;
    }

    if (!isSepolia) {
      setError("Please switch to Ethereum Sepolia");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log("\n🚀 Releasing tokens on Ethereum...");
      console.log("Vesting ID:", vestingId);

      const vestingWalletABI = [
        "function release(uint256 vestingId) external",
        "event TokensReleased(uint256 indexed vestingId, address indexed beneficiary, bytes32 amount)",
      ];

      const vestingWallet = new ethers.Contract(
        config.contracts.vesting.wallet,
        vestingWalletABI,
        signer
      );

      console.log("📡 Sending transaction...");
      console.log("   This will:");
      console.log("   1. Calculate releasable amount in FHE (encrypted)");
      console.log("   2. Decrypt only the releasable amount");
      console.log("   3. Transfer tokens to you");
      console.log("   4. Update released amount (stays encrypted)");

      const tx = await vestingWallet.release(vestingId);

      console.log("⏳ Waiting for confirmation...");
      console.log("   TX Hash:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✅ Tokens released!");
      console.log("   Block:", receipt.blockNumber);
      console.log("   Gas used:", receipt.gasUsed.toString());

      setSuccess("🎉 Tokens released successfully! Check your balance.");
      
      // Reset to view step
      setTimeout(() => {
        setStep("view");
        loadVestingData(); // Reload data
      }, 3000);

    } catch (err: any) {
      console.error("❌ Error:", err);
      setError(err.message || "Failed to release tokens");
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.gradientText0}>Vesting Beneficiary</span>
          </h1>

          <p className={styles.description}>
            View and claim your vested tokens
          </p>

          <div className={styles.connect}>
            <ConnectButton chainStatus="icon" showBalance={false} />
          </div>
        </div>

        {address && (
          <div className={styles.mintSection}>
            {/* Navigation */}
            <div style={{ marginBottom: "20px" }}>
              <Link href="/">
                <button className={styles.button} style={{ backgroundColor: "#6c757d" }}>
                  ← Back to Home
                </button>
              </Link>
              <Link href="/vesting-admin">
                <button className={styles.button} style={{ backgroundColor: "#007bff", marginLeft: "10px" }}>
                  Admin View →
                </button>
              </Link>
            </div>

            {/* Load Vesting */}
            <div className={styles.card}>
              <h2>Load Vesting</h2>
              
              <label>
                <strong>Vesting ID:</strong>
                <input
                  type="number"
                  value={vestingId}
                  onChange={(e) => setVestingId(e.target.value)}
                  placeholder="Enter vesting ID"
                  style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                />
              </label>

              <button
                onClick={loadVestingData}
                disabled={isLoading}
                className={styles.button}
              >
                {isLoading ? "Loading..." : "Load Vesting Data"}
              </button>
            </div>

            {/* Vesting Details */}
            {vestingData && (
              <div className={styles.card} style={{ marginTop: "20px" }}>
                <h2>Vesting Details</h2>
                
                <div className={styles.infoBox}>
                  <p><strong>Vesting ID:</strong> {vestingData.id}</p>
                  <p><strong>Beneficiary:</strong> {vestingData.beneficiary}</p>
                  <p><strong>Your Address:</strong> {address}</p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {vestingData.isBeneficiary ? (
                      <span style={{ color: "green" }}>✅ You are the beneficiary</span>
                    ) : (
                      <span style={{ color: "red" }}>❌ Not your vesting</span>
                    )}
                  </p>
                  <p><strong>Active:</strong> {vestingData.active ? "Yes" : "No"}</p>
                  <p>
                    <strong>Start:</strong>{" "}
                    {new Date(vestingData.startTimestamp * 1000).toLocaleString()}
                  </p>
                  <p>
                    <strong>Duration:</strong> {vestingData.duration} seconds (
                    {Math.floor(vestingData.duration / 86400)} days)
                  </p>
                  <p>
                    <strong>Cliff:</strong> {vestingData.cliff} seconds (
                    {Math.floor(vestingData.cliff / 86400)} days)
                  </p>
                  <p>
                    <strong>Cliff Status:</strong>{" "}
                    {vestingData.cliffPassed ? (
                      <span style={{ color: "green" }}>✅ Passed</span>
                    ) : (
                      <span style={{ color: "orange" }}>⏳ Not yet</span>
                    )}
                  </p>
                  <p><strong>Progress:</strong> {vestingData.progress}% vested</p>
                  
                  {/* Progress Bar */}
                  <div style={{ 
                    width: "100%", 
                    height: "20px", 
                    backgroundColor: "#e0e0e0", 
                    borderRadius: "10px",
                    overflow: "hidden",
                    marginTop: "10px"
                  }}>
                    <div style={{
                      width: `${vestingData.progress}%`,
                      height: "100%",
                      backgroundColor: "#28a745",
                      transition: "width 0.3s"
                    }}></div>
                  </div>
                  
                  <p style={{ marginTop: "10px", fontSize: "14px", color: "#6c757d" }}>
                    💡 <strong>Privacy Note:</strong> The total amount is encrypted and never revealed on-chain!
                  </p>
                </div>

                {/* Action Buttons */}
                {vestingData.isBeneficiary && vestingData.active && (
                  <>
                    {step === "view" && (
                      <>
                        <div className={styles.infoBox} style={{ marginTop: "20px" }}>
                          <p><strong>Network:</strong> {chain?.name || "Not connected"}</p>
                          <p><strong>Required:</strong> Arbitrum Sepolia</p>
                        </div>

                        {!isArbitrum && (
                          <button
                            onClick={() => switchChain?.({ chainId: arbitrumSepolia.id })}
                            className={styles.button}
                            style={{ backgroundColor: "#ffc107", color: "#000" }}
                          >
                            Switch to Arbitrum Sepolia
                          </button>
                        )}

                        <button
                          onClick={requestReleaseOnArbitrum}
                          disabled={isLoading || !isArbitrum || !vestingData.cliffPassed}
                          className={styles.button}
                          style={{ marginTop: "10px" }}
                        >
                          {isLoading ? "Requesting..." : "Request Token Release"}
                        </button>
                      </>
                    )}

                    {step === "release" && (
                      <>
                        <div className={styles.infoBox} style={{ marginTop: "20px" }}>
                          <p><strong>Network:</strong> {chain?.name || "Not connected"}</p>
                          <p><strong>Required:</strong> Ethereum Sepolia</p>
                        </div>

                        {!isSepolia && (
                          <button
                            onClick={() => switchChain?.({ chainId: sepolia.id })}
                            className={styles.button}
                            style={{ backgroundColor: "#ffc107", color: "#000" }}
                          >
                            Switch to Ethereum Sepolia
                          </button>
                        )}

                        <button
                          onClick={releaseTokensOnEthereum}
                          disabled={isLoading || !isSepolia}
                          className={styles.button}
                          style={{ marginTop: "10px", backgroundColor: "#28a745" }}
                        >
                          {isLoading ? "Releasing..." : "🎉 Release Tokens on Ethereum"}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Error/Success Messages */}
            {error && <div className={styles.error}>{error}</div>}
            {success && (
              <div className={styles.proofResult} style={{ backgroundColor: "#d4edda", marginTop: "20px" }}>
                {success}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};

export default VestingBeneficiary;

