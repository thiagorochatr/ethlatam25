// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SimpleMockToken
 * @notice ULTRA-SIMPLE mock token for testing vesting
 * @dev This bypasses FHE complexity for minting, but still maintains FHE compatibility
 * 
 * Key features:
 * - Simple uint256 balances for easy minting
 * - Converts to euint64 when needed for vesting factory
 * - ERC7984-compatible interface
 * - Anyone can mint (testing only!)
 */
contract SimpleMockToken is SepoliaConfig {
    string public name = "Simple Mock Token";
    string public symbol = "SMT";
    uint8 public constant decimals = 18;
    
    address public owner;
    
    // Use regular balances for simplicity
    mapping(address => uint256) private _clearBalances;
    uint256 private _clearTotalSupply;
    
    // Store encrypted versions only when needed
    mapping(address => euint64) private _encryptedBalances;
    mapping(address => mapping(address => bool)) private _operators;
    
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event OperatorSet(address indexed owner, address indexed operator, bool approved);
    event Minted(address indexed to, uint256 amount);
    
    error ZeroAddress();
    error NotOperator();
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Mint tokens - SUPER EASY, no FHE needed!
     * @param to Recipient
     * @param amount Amount in wei
     */
    function mint(address to, uint256 amount) external {
        if (to == address(0)) revert ZeroAddress();
        
        _clearBalances[to] += amount;
        _clearTotalSupply += amount;
        
        emit Minted(to, amount);
        emit Transfer(address(0), to, amount);
    }
    
    /**
     * @notice Get balance (returns as uint256 for easy checking)
     */
    function balanceOf(address account) external view returns (uint256) {
        return _clearBalances[account];
    }
    
    /**
     * @notice Get encrypted balance (required for ERC7984)
     * Converts uint256 to euint64 on-demand
     */
    function confidentialBalanceOf(address account) external view returns (euint64) {
        // Return the stored encrypted balance if it exists
        // Otherwise return a zero encrypted value
        return _encryptedBalances[account];
    }
    
    /**
     * @notice Transfer from (for vesting factory)
     * @dev This is called by the factory to fund vesting wallets
     */
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64) {
        if (!_operators[from][msg.sender]) revert NotOperator();
        
        // For simplicity, we'll accept any transfer
        // In real scenario, you'd decrypt amount and check balance
        // But for testing, we just mark it as transferred
        
        // Store the encrypted amount at destination
        _encryptedBalances[to] = amount;
        
        // Allow the vesting wallet to see this encrypted balance
        FHE.allow(amount, to);
        FHE.allow(amount, msg.sender);
        
        return amount;
    }
    
    /**
     * @notice Transfer tokens (regular)
     */
    function confidentialTransfer(address to, euint64 amount) external returns (euint64) {
        if (to == address(0)) revert ZeroAddress();
        
        // Store encrypted amount at destination
        _encryptedBalances[to] = amount;
        
        FHE.allow(amount, to);
        FHE.allow(amount, msg.sender);
        
        return amount;
    }
    
    /**
     * @notice Set operator approval (for factory)
     */
    function setOperator(address operator, bool approved) external {
        _operators[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }
    
    /**
     * @notice Check operator status
     */
    function isOperator(address account, address operator) external view returns (bool) {
        return _operators[account][operator];
    }
    
    /**
     * @notice Get total supply
     */
    function totalSupply() external view returns (uint256) {
        return _clearTotalSupply;
    }
}

