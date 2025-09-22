// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PINTUToken
 * @dev Staking token with 12% APR rewards (inspired by Indonesian exchange PTU token)
 * @notice Features staking mechanism with automatic reward calculation
 */
contract PINTUToken is ERC20, ERC20Burnable, Ownable, ERC20Pausable, ReentrancyGuard {
    uint256 public constant INITIAL_SUPPLY = 10_000_000 * 10**18; // 10M tokens
    uint256 public constant MAX_SUPPLY = 15_000_000 * 10**18; // 15M max (for rewards)
    uint256 public constant STAKING_APR = 1200; // 12% APR (in basis points, 100 = 1%)
    uint256 public constant SECONDS_PER_YEAR = 31536000;

    mapping(address => bool) public isMinter;
    mapping(address => StakingInfo) public stakingInfo;

    struct StakingInfo {
        uint256 stakedAmount;
        uint256 lastRewardTime;
        uint256 accumulatedRewards;
    }

    uint256 public totalStaked;
    uint256 public totalRewardsPaid;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 rewards);
    event TokensBurned(address indexed burner, uint256 amount, uint256 reason);

    modifier onlyMinter() {
        require(isMinter[msg.sender] || msg.sender == owner(), "Not a minter");
        _;
    }

    constructor() ERC20("PINTU Token", "PINTU") Ownable(msg.sender) {
        isMinter[msg.sender] = true;
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    /**
     * @dev Calculate pending rewards for a user
     * @param user Address to calculate rewards for
     */
    function calculatePendingRewards(address user) public view returns (uint256) {
        StakingInfo memory info = stakingInfo[user];

        if (info.stakedAmount == 0) {
            return info.accumulatedRewards;
        }

        uint256 timeDiff = block.timestamp - info.lastRewardTime;
        uint256 yearlyReward = (info.stakedAmount * STAKING_APR) / 10000;
        uint256 pendingReward = (yearlyReward * timeDiff) / SECONDS_PER_YEAR;

        return info.accumulatedRewards + pendingReward;
    }

    /**
     * @dev Update rewards for a user (internal)
     */
    function _updateRewards(address user) internal {
        uint256 pending = calculatePendingRewards(user);
        stakingInfo[user].accumulatedRewards = pending;
        stakingInfo[user].lastRewardTime = block.timestamp;
    }

    /**
     * @dev Stake PINTU tokens to earn 12% APR
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot stake 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _updateRewards(msg.sender);

        _transfer(msg.sender, address(this), amount);
        stakingInfo[msg.sender].stakedAmount += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @dev Unstake PINTU tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot unstake 0");
        require(stakingInfo[msg.sender].stakedAmount >= amount, "Insufficient staked");

        _updateRewards(msg.sender);

        stakingInfo[msg.sender].stakedAmount -= amount;
        totalStaked -= amount;
        _transfer(address(this), msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @dev Claim accumulated staking rewards
     */
    function claimRewards() external nonReentrant {
        _updateRewards(msg.sender);

        uint256 rewards = stakingInfo[msg.sender].accumulatedRewards;
        require(rewards > 0, "No rewards to claim");

        stakingInfo[msg.sender].accumulatedRewards = 0;

        // Mint rewards if within max supply
        if (totalSupply() + rewards <= MAX_SUPPLY) {
            _mint(msg.sender, rewards);
            totalRewardsPaid += rewards;
            emit RewardsClaimed(msg.sender, rewards);
        } else {
            // If max supply reached, pay from contract balance
            require(balanceOf(address(this)) >= rewards + totalStaked, "Insufficient reward pool");
            _transfer(address(this), msg.sender, rewards);
            totalRewardsPaid += rewards;
            emit RewardsClaimed(msg.sender, rewards);
        }
    }

    /**
     * @dev Get staking statistics for a user
     */
    function getStakingInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 pendingRewards,
        uint256 apr,
        uint256 totalUserBalance
    ) {
        uint256 pending = calculatePendingRewards(user);
        return (
            stakingInfo[user].stakedAmount,
            pending,
            STAKING_APR,
            balanceOf(user) + stakingInfo[user].stakedAmount
        );
    }

    /**
     * @dev Get global staking statistics
     */
    function getGlobalStats() external view returns (
        uint256 totalStakedGlobal,
        uint256 totalRewardsPaidGlobal,
        uint256 contractBalance,
        uint256 apr
    ) {
        return (
            totalStaked,
            totalRewardsPaid,
            balanceOf(address(this)),
            STAKING_APR
        );
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
     * @dev Monthly burn mechanism (0.01%-0.03% of trading value)
     * @param amount Amount to burn
     * @param reason 0: user burn, 1: protocol burn
     */
    function protocolBurn(uint256 amount, uint256 reason) external onlyOwner {
        require(balanceOf(address(this)) >= amount + totalStaked, "Would affect staked funds");
        _burn(address(this), amount);
        emit TokensBurned(address(this), amount, reason);
    }

    /**
     * @dev Pause token transfers and staking
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers and staking
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
        uint256 stakingAPR
    ) {
        return (
            "PINTU Token",
            "PINTU",
            18,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            STAKING_APR
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