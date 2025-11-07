# 🚀 Deploy Manual no Arbitrum Sepolia

## ⚠️ Problema

O plugin `@fhevm/hardhat-plugin` não suporta Arbitrum, causando erro ao tentar deploy via Hardhat.

## ✅ Solução: Deploy Manual

### **Opção 1: Usar Remix IDE (Mais Fácil)**

1. **Abra Remix**: https://remix.ethereum.org

2. **Copie o contrato**:
   - Arquivo: `fhevm-react-template/packages/hardhat/contracts/VestingController.sol`
   - Cole no Remix (criar novo arquivo)

3. **Compile**:
   - Compiler: 0.8.24 ou superior
   - Clique "Compile VestingController.sol"

4. **Deploy**:
   - Aba "Deploy & Run Transactions"
   - Environment: "Injected Provider - MetaMask"
   - **Troque para Arbitrum Sepolia no MetaMask!**
   - Network: 421614
   - RPC: https://sepolia-rollup.arbitrum.io/rpc
   - Clique "Deploy"

5. **Copie o address** deployado!

---

### **Opção 2: Usar Cast (Foundry)**

```bash
# Instalar Foundry (se não tiver)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Deploy
cd fhevm-react-template/packages/hardhat

cast create VestingController \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key YOUR_PRIVATE_KEY \
  --verify --etherscan-api-key YOUR_ARBISCAN_KEY
```

---

### **Opção 3: Script Node Standalone**

```bash
cd fhevm-react-template/packages/hardhat

# Obter sua private key (CUIDADO!)
# Use a conta do deployer da Ethereum que já foi usado

# Executar script
PRIVATE_KEY=0x... node scripts/deploy-arbitrum-standalone.js
```

**Script já está criado em:**
`scripts/deploy-arbitrum-standalone.js`

---

## 📋 Após o Deploy

### **Atualize .env.local**

```bash
# Arbitrum Sepolia (que você acabou de fazer deploy)
NEXT_PUBLIC_VESTING_CONTROLLER=0x...

# Ethereum Sepolia (já deployado)
NEXT_PUBLIC_VESTING_TOKEN=0xE9460093b1594d2DE1C04Be9CbDc4Ee8411A66B7
NEXT_PUBLIC_VESTING_WALLET=0x748E9d146795481F6665E71dE73Df0FEe4761e43
```

### **Teste o Sistema**

```bash
cd app
npm run dev
```

Acesse:
- Admin: http://localhost:3000/vesting-admin
- Beneficiary: http://localhost:3000/vesting-beneficiary

---

## 🎯 Resumo dos Endereços

```
✅ ETHEREUM SEPOLIA (Computation Layer - FHE)
   • ConfidentialVestingToken: 0xE9460093b1594d2DE1C04Be9CbDc4Ee8411A66B7
   • VestingWallet: 0x748E9d146795481F6665E71dE73Df0FEe4761e43

⏳ ARBITRUM SEPOLIA (Orchestration Layer)
   • VestingController: <fazer deploy>
```

---

## 💡 Dica

Se tiver Arbitrum Sepolia ETH e quiser fazer o deploy rápido:

1. Use Remix (mais fácil!)
2. Ou peça para eu criar um script Python/JS que não dependa do Hardhat

---

**Need help? Pergunte!** 🚀

