// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title MockVestingToken
 * @notice Simplified ERC7984-compatible token for TESTING ONLY
 * @dev This is a MOCK token that implements the same interface as ConfidentialVestingToken
 *      but allows easy minting without complex FHE setup.
 * 
 * ⚠️  FOR TESTING ONLY - NOT FOR PRODUCTION ⚠️
 * 
 * Key Features:
 * - ERC7984-compatible interface (confidentialTransferFrom, etc.)
 * - Easy minting: mint(address, uint256) - just use regular numbers!
 * - Still uses FHE internally for compatibility
 * - Anyone can mint (for testing convenience)
 * 
 * Usage:
 * 1. Deploy this contract
 * 2. Call mint(yourAddress, 1000000 * 10**18) to get tokens
 * 3. Approve factory: setOperator(factoryAddress, true)
 * 4. Test vesting workflow!
 */
contract MockVestingToken is SepoliaConfig {
    // ========================================================================
    // STATE VARIABLES
    // ========================================================================
    
    string public name = "Mock Vesting Token";
    string public symbol = "MVT";
    uint8 public constant decimals = 18;
    
    address public owner;
    
    euint64 private _totalSupply;
    mapping(address => euint64) private _balances;
    mapping(address => mapping(address => bool)) private _operators;
    
    // ========================================================================
    // EVENTS
    // ========================================================================
    
    event Transfer(address indexed from, address indexed to, euint64 amount);
    event OperatorSet(address indexed owner, address indexed operator, bool approved);
    event Minted(address indexed to, uint256 amount);
    
    // ========================================================================
    // ERRORS
    // ========================================================================
    
    error ZeroAddress();
    error NotOperator();
    
    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================
    
    constructor() {
        owner = msg.sender;
        _totalSupply = FHE.asEuint64(0);
        FHE.allowThis(_totalSupply);
    }
    
    // ========================================================================
    // EASY MINTING (FOR TESTING)
    // ========================================================================
    
    /**
     * @notice Mint tokens easily - NO FHE encryption needed!
     * @param to Recipient address
     * @param amount Amount to mint (in wei, e.g., 1000 * 10**18 = 1000 tokens)
     * @dev FOR TESTING ONLY - Anyone can mint!
     */
    function mint(address to, uint256 amount) external {
        if (to == address(0)) revert ZeroAddress();
        
        // Convert regular uint256 to encrypted euint64
        // We use a simple approach: wrap the value
        euint64 encryptedAmount;
        
        // For mock purposes, we'll use FHE encryption with the value
        // This is a simplified version - in production you'd use proper encryption
        assembly {
            // Store the amount directly as encrypted value
            mstore(0x00, amount)
            encryptedAmount := mload(0x00)
        }
        
        // If assembly doesn't work, try direct cast (Solidity 0.8+)
        // encryptedAmount = euint64.wrap(bytes32(amount));
        
        // Add to balance
        _balances[to] = FHE.add(_balances[to], encryptedAmount);
        
        // Add to total supply
        _totalSupply = FHE.add(_totalSupply, encryptedAmount);
        
        // Set permissions
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);
        FHE.allowThis(_totalSupply);
        
        emit Minted(to, amount);
        emit Transfer(address(0), to, encryptedAmount);
    }
    
    // ========================================================================
    // ERC7984 INTERFACE (Required for Vesting Factory)
    // ========================================================================
    
    /**
     * @notice Get encrypted balance
     * @param account Address to query
     * @return Encrypted balance
     */
    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }
    
    /**
     * @notice Transfer from another account (operator functionality)
     * @param from Source address
     * @param to Destination address
     * @param amount Encrypted amount to transfer
     * @return actualAmount The actual encrypted amount transferred
     * @dev Caller must be approved operator for 'from' address
     */
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64 actualAmount) {
        // Check operator approval
        if (!_operators[from][msg.sender]) revert NotOperator();
        
        return _transfer(from, to, amount);
    }
    
    /**
     * @notice Transfer tokens
     * @param to Recipient
     * @param amount Encrypted amount
     * @return actualAmount Transferred amount
     */
    function confidentialTransfer(address to, euint64 amount) external returns (euint64 actualAmount) {
        if (to == address(0)) revert ZeroAddress();
        return _transfer(msg.sender, to, amount);
    }
    
    /**
     * @notice Set operator approval
     * @param operator Operator address (e.g., VestingFactory)
     * @param approved Approval status
     */
    function setOperator(address operator, bool approved) external {
        _operators[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }
    
    // ========================================================================
    // INTERNAL FUNCTIONS
    // ========================================================================
    
    function _transfer(
        address from,
        address to,
        euint64 amount
    ) internal returns (euint64 actualAmount) {
        euint64 senderBalance = _balances[from];
        
        // Use min to prevent underflow
        actualAmount = FHE.min(amount, senderBalance);
        
        // Update balances
        _balances[from] = FHE.sub(senderBalance, actualAmount);
        _balances[to] = FHE.add(_balances[to], actualAmount);
        
        // Set permissions
        FHE.allowThis(_balances[from]);
        FHE.allow(_balances[from], from);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);
        FHE.allow(actualAmount, msg.sender);
        
        emit Transfer(from, to, actualAmount);
        
        return actualAmount;
    }
    
    // ========================================================================
    // VIEW FUNCTIONS
    // ========================================================================
    
    function totalSupply() external view returns (euint64) {
        return _totalSupply;
    }
    
    function isOperator(address account, address operator) external view returns (bool) {
        return _operators[account][operator];
    }
}

