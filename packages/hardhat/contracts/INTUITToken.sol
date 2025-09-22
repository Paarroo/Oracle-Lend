// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

/**
 * @title INTUITToken
 * @dev Utility token for intuition-based predictions and oracle services
 * @notice Features burning mechanism for deflationary pressure
 */
contract INTUITToken is ERC20, ERC20Burnable, Ownable, ERC20Pausable {
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 100M tokens
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;

    mapping(address => bool) public isMinter;
    uint256 public totalBurned;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokensBurned(address indexed burner, uint256 amount);

    modifier onlyMinter() {
        require(isMinter[msg.sender] || msg.sender == owner(), "Not a minter");
        _;
    }

    constructor() ERC20("INTUIT Token", "INTUIT") Ownable(msg.sender) {
        isMinter[msg.sender] = true;
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    /**
     * @dev Add a new minter
     * @param minter Address to grant minting permission
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid address");
        require(!isMinter[minter], "Already a minter");
        isMinter[minter] = true;
        emit MinterAdded(minter);
    }

    /**
     * @dev Remove a minter
     * @param minter Address to revoke minting permission
     */
    function removeMinter(address minter) external onlyOwner {
        require(isMinter[minter], "Not a minter");
        isMinter[minter] = false;
        emit MinterRemoved(minter);
    }

    /**
     * @dev Mint new tokens (restricted to minters)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @dev Override burn to track total burned
     * @param amount Amount to burn
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @dev Pause token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get token info
     */
    function getTokenInfo() external pure returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 supply,
        uint256 maxSupply,
        uint256 burned
    ) {
        return (
            "INTUIT Token",
            "INTUIT",
            18,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            0
        );
    }

    /**
     * @dev Required override for pausable functionality
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}