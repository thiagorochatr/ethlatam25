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
 * Vesting Admin Page
 * 
 * FASE 1: Create vestings with localStorage communication
 * 
 * Flow:
 * 1. Admin fills form (beneficiary, amount, duration, cliff)
 * 2. Frontend encrypts amount using Zama SDK (TODO: implement)
 * 3. Admin creates vesting on Arbitrum (VestingController)
 * 4. Frontend listens to event and stores data in localStorage
 * 5. Admin manually initializes vesting on Ethereum (VestingWallet)
 * 6. Admin sets encrypted amount on Ethereum
 * 
 * Future (FASE 2):
 * - CCIP will replace localStorage
 * - Automatic cross-chain messaging
 */
const VestingAdmin: NextPage = () => {
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // Form state
  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [cliff, setCliff] = useState("");
  
  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState(1);
  const [vestingId, setVestingId] = useState<number | null>(null);
  
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
  // STEP 1: Create Vesting on Arbitrum
  // ========================================================================
  
  const createVestingOnArbitrum = async () => {
    if (!address || !signer) {
      setError("Please connect wallet");
      return;
    }

    if (!beneficiary || !amount || !duration || !cliff) {
      setError("Please fill all fields");
      return;
    }

    // Validate inputs
    if (!ethers.isAddress(beneficiary)) {
      setError("Invalid beneficiary address");
      return;
    }

    const amountNum = parseFloat(amount);
    const durationNum = parseInt(duration);
    const cliffNum = parseInt(cliff);

    if (amountNum <= 0) {
      setError("Amount must be greater than 0");
      return;
    }

    if (durationNum <= 0) {
      setError("Duration must be greater than 0");
      return;
    }

    if (cliffNum > durationNum) {
      setError("Cliff cannot be greater than duration");
      return;
    }

    // Switch to Arbitrum if needed
    if (!isArbitrum) {
      setError("Please switch to Arbitrum Sepolia");
      return;
    }

    setIsCreating(true);
    setError("");
    setSuccess("");

    try {
      console.log("\n🚀 Creating vesting on Arbitrum...");
      
      // Create commitment (hash of amount for now - simplified FASE 1)
      // In production, this should be hash of encrypted amount
      const amountCommitment = ethers.keccak256(
        ethers.toUtf8Bytes(amount + Date.now().toString())
      );
      
      console.log("📝 Parameters:");
      console.log("  Beneficiary:", beneficiary);
      console.log("  Amount:", amount, "tokens (WILL BE PRIVATE)");
      console.log("  Duration:", durationNum, "seconds");
      console.log("  Cliff:", cliffNum, "seconds");
      console.log("  Commitment:", amountCommitment);

      // Calculate timestamps
      const now = Math.floor(Date.now() / 1000);
      const startTimestamp = now + 60; // Start in 1 minute

      // Contract ABI
      const vestingControllerABI = [
        "function createVesting(address beneficiary, uint64 startTimestamp, uint64 duration, uint64 cliff, bytes32 amountCommitment, bytes zkProof) external returns (uint256)",
        "function nextVestingId() external view returns (uint256)",
        "event VestingCreated(uint256 indexed vestingId, address indexed beneficiary, uint64 startTimestamp, uint64 duration, uint64 cliff, bytes32 amountCommitment)",
      ];

      const vestingController = new ethers.Contract(
        config.contracts.vesting.controller,
        vestingControllerABI,
        signer
      );

      // Get next vesting ID
      const nextId = await vestingController.nextVestingId();
      console.log("📊 Next Vesting ID:", nextId.toString());

      // Create vesting (with empty ZK proof for FASE 1)
      console.log("📡 Sending transaction...");
      const tx = await vestingController.createVesting(
        beneficiary,
        startTimestamp,
        durationNum,
        cliffNum,
        amountCommitment,
        "0x" // Empty ZK proof for FASE 1
      );

      console.log("⏳ Waiting for confirmation...");
      console.log("   TX Hash:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed!");
      console.log("   Block:", receipt.blockNumber);
      console.log("   Gas used:", receipt.gasUsed.toString());

      // Store vesting data in localStorage (FASE 1 communication)
      const vestingData = {
        vestingId: nextId.toString(),
        beneficiary,
        amount, // Plain amount - will encrypt in next step
        startTimestamp,
        duration: durationNum,
        cliff: cliffNum,
        commitment: amountCommitment,
        createdAt: Date.now(),
      };

      localStorage.setItem(`vesting_${nextId}`, JSON.stringify(vestingData));
      console.log("💾 Vesting data saved to localStorage");

      setVestingId(Number(nextId));
      setStep(2);
      setSuccess(`Vesting #${nextId} created on Arbitrum! Now initialize on Ethereum.`);

    } catch (err: any) {
      console.error("❌ Error:", err);
      setError(err.message || "Failed to create vesting");
    } finally {
      setIsCreating(false);
    }
  };

  // ========================================================================
  // STEP 2: Initialize Vesting on Ethereum
  // ========================================================================
  
  const initializeVestingOnEthereum = async () => {
    if (!vestingId) {
      setError("No vesting ID found");
      return;
    }

    // Switch to Ethereum Sepolia
    if (!isSepolia) {
      setError("Please switch to Ethereum Sepolia");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      console.log("\n🚀 Initializing vesting on Ethereum...");
      
      // Get vesting data from localStorage
      const vestingDataStr = localStorage.getItem(`vesting_${vestingId}`);
      if (!vestingDataStr) {
        throw new Error("Vesting data not found in localStorage");
      }

      const vestingData = JSON.parse(vestingDataStr);
      console.log("📝 Vesting Data:", vestingData);

      // Contract ABI
      const vestingWalletABI = [
        "function initializeVesting(uint256 vestingId, address beneficiary, uint64 startTimestamp, uint64 duration, uint64 cliff) external",
        "function setController(address newController) external",
      ];

      const vestingWallet = new ethers.Contract(
        config.contracts.vesting.wallet,
        vestingWalletABI,
        signer
      );

      // Initialize vesting
      console.log("📡 Sending transaction...");
      const tx = await vestingWallet.initializeVesting(
        vestingId,
        vestingData.beneficiary,
        vestingData.startTimestamp,
        vestingData.duration,
        vestingData.cliff
      );

      console.log("⏳ Waiting for confirmation...");
      const receipt = await tx.wait();
      console.log("✅ Vesting initialized on Ethereum!");

      setStep(3);
      setSuccess(`Vesting #${vestingId} initialized! Now set encrypted amount.`);

    } catch (err: any) {
      console.error("❌ Error:", err);
      setError(err.message || "Failed to initialize vesting");
    } finally {
      setIsCreating(false);
    }
  };

  // ========================================================================
  // STEP 3: Set Encrypted Amount
  // ========================================================================
  
  const setEncryptedAmount = async () => {
    if (!vestingId) {
      setError("No vesting ID found");
      return;
    }

    setError("⚠️ FASE 1: Encryption not fully implemented yet. Use manual testing.");
    
    // TODO FASE 1: Implement Zama encryption
    // This requires:
    // 1. Initialize Zama FHE instance
    // 2. Encrypt amount using createEncryptedInput
    // 3. Call setVestingAmount with encrypted data
    
    console.log("🔐 Encryption flow (TODO):");
    console.log("1. Get vesting data from localStorage");
    console.log("2. Encrypt amount using Zama SDK");
    console.log("3. Call VestingWallet.setVestingAmount()");
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.gradientText0}>Vesting Admin</span>
          </h1>

          <p className={styles.description}>
            Create confidential vesting schedules with FHE
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
              <Link href="/vesting-beneficiary">
                <button className={styles.button} style={{ backgroundColor: "#17a2b8", marginLeft: "10px" }}>
                  Beneficiary View →
                </button>
              </Link>
            </div>

            {/* Progress Steps */}
            <div className={styles.card}>
              <h3>Progress</h3>
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <div style={{ 
                  flex: 1, 
                  padding: "10px", 
                  backgroundColor: step >= 1 ? "#28a745" : "#6c757d",
                  color: "white",
                  textAlign: "center",
                  borderRadius: "4px"
                }}>
                  1. Create (Arbitrum)
                </div>
                <div style={{ 
                  flex: 1, 
                  padding: "10px", 
                  backgroundColor: step >= 2 ? "#28a745" : "#6c757d",
                  color: "white",
                  textAlign: "center",
                  borderRadius: "4px"
                }}>
                  2. Initialize (Ethereum)
                </div>
                <div style={{ 
                  flex: 1, 
                  padding: "10px", 
                  backgroundColor: step >= 3 ? "#28a745" : "#6c757d",
                  color: "white",
                  textAlign: "center",
                  borderRadius: "4px"
                }}>
                  3. Set Amount (Ethereum)
                </div>
              </div>

              {/* Step 1: Create on Arbitrum */}
              {step === 1 && (
                <>
                  <h2>Step 1: Create Vesting on Arbitrum</h2>
                  
                  <div className={styles.infoBox}>
                    <p><strong>Network:</strong> {chain?.name || "Not connected"}</p>
                    <p><strong>Required:</strong> Arbitrum Sepolia</p>
                    {!isArbitrum && (
                      <button
                        onClick={() => switchChain?.({ chainId: arbitrumSepolia.id })}
                        className={styles.button}
                        style={{ backgroundColor: "#ffc107", color: "#000" }}
                      >
                        Switch to Arbitrum Sepolia
                      </button>
                    )}
                  </div>

                  <div style={{ marginTop: "20px" }}>
                    <label>
                      <strong>Beneficiary Address:</strong>
                      <input
                        type="text"
                        value={beneficiary}
                        onChange={(e) => setBeneficiary(e.target.value)}
                        placeholder="0x..."
                        style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                      />
                    </label>

                    <label>
                      <strong>Amount (tokens):</strong>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="1000000"
                        style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                      />
                      <small>⚠️ This will be ENCRYPTED (private on-chain)</small>
                    </label>

                    <label>
                      <strong>Duration (seconds):</strong>
                      <input
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="31536000"
                        style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                      />
                      <small>Example: 31536000 = 1 year</small>
                    </label>

                    <label>
                      <strong>Cliff (seconds):</strong>
                      <input
                        type="number"
                        value={cliff}
                        onChange={(e) => setCliff(e.target.value)}
                        placeholder="15768000"
                        style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                      />
                      <small>Example: 15768000 = 6 months</small>
                    </label>

                    <button
                      onClick={createVestingOnArbitrum}
                      disabled={isCreating || !isArbitrum}
                      className={styles.button}
                      style={{ marginTop: "20px" }}
                    >
                      {isCreating ? "Creating..." : "Create Vesting on Arbitrum"}
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Initialize on Ethereum */}
              {step === 2 && (
                <>
                  <h2>Step 2: Initialize on Ethereum</h2>
                  
                  <div className={styles.infoBox}>
                    <p><strong>Vesting ID:</strong> {vestingId}</p>
                    <p><strong>Network:</strong> {chain?.name || "Not connected"}</p>
                    <p><strong>Required:</strong> Ethereum Sepolia</p>
                    {!isSepolia && (
                      <button
                        onClick={() => switchChain?.({ chainId: sepolia.id })}
                        className={styles.button}
                        style={{ backgroundColor: "#ffc107", color: "#000" }}
                      >
                        Switch to Ethereum Sepolia
                      </button>
                    )}
                  </div>

                  <button
                    onClick={initializeVestingOnEthereum}
                    disabled={isCreating || !isSepolia}
                    className={styles.button}
                    style={{ marginTop: "20px" }}
                  >
                    {isCreating ? "Initializing..." : "Initialize Vesting on Ethereum"}
                  </button>
                </>
              )}

              {/* Step 3: Set Encrypted Amount */}
              {step === 3 && (
                <>
                  <h2>Step 3: Set Encrypted Amount</h2>
                  
                  <div className={styles.infoBox}>
                    <p><strong>Vesting ID:</strong> {vestingId}</p>
                    <p><strong>Status:</strong> Initialized, waiting for amount</p>
                  </div>

                  <div style={{ padding: "15px", backgroundColor: "#fff3cd", borderRadius: "8px", marginTop: "20px" }}>
                    <h4>⚠️ FASE 1 Note:</h4>
                    <p>Encryption functionality is in progress. For now:</p>
                    <ol>
                      <li>Use Zama SDK to encrypt amount client-side</li>
                      <li>Call VestingWallet.setVestingAmount() manually</li>
                      <li>Full integration coming soon!</li>
                    </ol>
                  </div>

                  <button
                    onClick={setEncryptedAmount}
                    disabled={true}
                    className={styles.button}
                    style={{ marginTop: "20px", opacity: 0.5 }}
                  >
                    Set Encrypted Amount (TODO)
                  </button>
                </>
              )}

              {/* Error/Success Messages */}
              {error && <div className={styles.error}>{error}</div>}
              {success && (
                <div className={styles.proofResult} style={{ backgroundColor: "#d4edda" }}>
                  {success}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default VestingAdmin;

