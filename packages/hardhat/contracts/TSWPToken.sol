// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title TSWPToken
 * @dev Governance token for swap protocol decisions
 * @notice Features voting capabilities for protocol governance
 */
contract TSWPToken is ERC20, ERC20Votes, Ownable, ERC20Pausable {
    uint256 public constant INITIAL_SUPPLY = 50_000_000 * 10**18; // 50M tokens
    uint256 public constant MAX_SUPPLY = 50_000_000 * 10**18;

    mapping(address => bool) public isMinter;
    mapping(uint256 => ProposalVote) public proposalVotes;
    uint256 public proposalCounter;

    struct ProposalVote {
        uint256 forVotes;
        uint256 againstVotes;
        uint256 endTime;
        bool executed;
        string description;
    }

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event ProposalCreated(uint256 indexed proposalId, string description, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votes);

    modifier onlyMinter() {
        require(isMinter[msg.sender] || msg.sender == owner(), "Not a minter");
        _;
    }

    constructor() ERC20("TSWP Token", "TSWP") EIP712("TSWP Token", "1") Ownable(msg.sender) {
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
     * @dev Create a governance proposal
     * @param description Proposal description
     * @param duration Voting duration in seconds
     */
    function createProposal(string memory description, uint256 duration) external onlyOwner returns (uint256) {
        require(duration > 0 && duration <= 7 days, "Invalid duration");

        uint256 proposalId = proposalCounter++;
        proposalVotes[proposalId] = ProposalVote({
            forVotes: 0,
            againstVotes: 0,
            endTime: block.timestamp + duration,
            executed: false,
            description: description
        });

        emit ProposalCreated(proposalId, description, block.timestamp + duration);
        return proposalId;
    }

    /**
     * @dev Cast a vote on a proposal
     * @param proposalId The proposal to vote on
     * @param support True for yes, false for no
     */
    function castVote(uint256 proposalId, bool support) external {
        ProposalVote storage proposal = proposalVotes[proposalId];
        require(block.timestamp < proposal.endTime, "Voting ended");
        require(!proposal.executed, "Proposal executed");

        uint256 votes = getVotes(msg.sender);
        require(votes > 0, "No voting power");

        if (support) {
            proposal.forVotes += votes;
        } else {
            proposal.againstVotes += votes;
        }

        emit VoteCast(proposalId, msg.sender, support, votes);
    }

    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) external view returns (
        uint256 forVotes,
        uint256 againstVotes,
        uint256 endTime,
        bool executed,
        string memory description
    ) {
        ProposalVote memory proposal = proposalVotes[proposalId];
        return (
            proposal.forVotes,
            proposal.againstVotes,
            proposal.endTime,
            proposal.executed,
            proposal.description
        );
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
        uint256 maxSupply
    ) {
        return (
            "TSWP Token",
            "TSWP",
            18,
            INITIAL_SUPPLY,
            MAX_SUPPLY
        );
    }

    /**
     * @dev Required override for pausable functionality
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes, ERC20Pausable)
    {
        super._update(from, to, value);
    }

}