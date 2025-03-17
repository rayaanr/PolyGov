// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SecondaryGovernance is ReentrancyGuard, Ownable {
    ERC20Votes public governanceToken;
    address public relayer;
    bool public isMainChain = false; // This flag identifies this as a secondary chain
    string public chainId; // Identifier for this specific chain

    enum ProposalStatus {
        Pending,
        Accepted,
        Rejected
    }

    struct Proposal {
        bytes32 id; // UUID for uniqueness
        string title;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 snapshotTimestamp; // Use timestamp instead of block number
        uint256 snapshotBlock;
        ProposalStatus status;
        bool voteTallied; // Tracks if votes have been sent to main chain
    }

    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    bytes32[] public proposalIds; // Store all proposal UUIDs for querying

    error OnlyRelayer();
    error ProposalAlreadyExists();
    error VotingPeriodEnded();
    error VotingPeriodNotEnded();
    error AlreadyVoted();
    error NoVotingPower();
    error ExecutionFailed();
    error VoteNotFinalized();
    error VoteAlreadyFinalized();
    error InvalidToken();

    event ProposalMirrored(
        bytes32 indexed id,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime,
        uint256 snapshotTimestamp,
        uint256 snapshotBlock
    );

    event Voted(
        bytes32 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    event VotesTallied(
        bytes32 indexed proposalId,
        uint256 yesVotes,
        uint256 noVotes
    );

    event TokenUpdated(address indexed newToken);
    
    event ProposalStatusUpdated(
        bytes32 indexed proposalId,
        ProposalStatus status
    );

    struct GovernanceConfig {
        address governanceToken;
        address relayer;
        string chainIdentifier;
    }

    constructor(GovernanceConfig memory config) Ownable(msg.sender) {
        require(config.governanceToken != address(0), "Invalid token address");
        require(config.relayer != address(0), "Invalid relayer address");
        require(bytes(config.chainIdentifier).length > 0, "Invalid chain ID");

        governanceToken = ERC20Votes(config.governanceToken);
        relayer = config.relayer;
        chainId = config.chainIdentifier;
    }

    /** --------------------------------------
     *  Admin: Update Governance Token Address
     * -------------------------------------- */
    function updateGovernanceToken(address _newToken) external onlyOwner {
        require(_newToken != address(0), "Invalid token address");
        governanceToken = ERC20Votes(_newToken);
        emit TokenUpdated(_newToken);
    }

    /** ----------------------------------------
     *  Mirror Proposal from Main Chain (for relayer only)
     * ---------------------------------------- */
    function mirrorProposal(
        bytes32 proposalId,
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _snapshotTimestamp
    ) external nonReentrant {
        if (msg.sender != relayer) revert OnlyRelayer();
        if (proposals[proposalId].startTime != 0)
            revert ProposalAlreadyExists();

        // Find closest block to snapshot timestamp
        uint256 closestBlock = findClosestBlockToTimestamp(_snapshotTimestamp);

        proposals[proposalId] = Proposal({
            id: proposalId,
            title: _title,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: _startTime,
            endTime: _endTime,
            snapshotTimestamp: _snapshotTimestamp,
            snapshotBlock: closestBlock,
            status: ProposalStatus.Pending,
            voteTallied: false
        });

        proposalIds.push(proposalId);

        emit ProposalMirrored(
            proposalId,
            _title,
            _description,
            _startTime,
            _endTime,
            _snapshotTimestamp,
            closestBlock
        );
    }

    /** ----------------------------------------
     *  Helper: Find closest block to timestamp
     * ---------------------------------------- */
    function findClosestBlockToTimestamp(uint256 timestamp) internal view returns (uint256) {
        // In a real implementation, you might use a more sophisticated approach
        // This is a simplified version that estimates based on average block time
        uint256 currentBlock = block.number;
        uint256 currentTime = block.timestamp;
        
        // Assuming 2 second block times (adjust as needed for your chain)
        uint256 blockTimeDiff = (currentTime - timestamp) / 2;
        
        // Ensure we don't go past block 0
        if (currentBlock <= blockTimeDiff) {
            return 1; // Return the earliest possible block
        }
        
        return currentBlock - blockTimeDiff;
    }

    /** ----------------------------------------
     *  Voting Logic (Timestamp-Based Snapshot)
     * ---------------------------------------- */
    function vote(bytes32 proposalId, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];

        if (block.timestamp >= proposal.endTime) revert VotingPeriodEnded();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        // Get voting power from snapshot
        uint256 votingPower = governanceToken.getPastVotes(
            msg.sender,
            proposal.snapshotBlock
        );
        if (votingPower == 0) revert NoVotingPower();

        if (_support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }

        hasVoted[proposalId][msg.sender] = true;

        emit Voted(proposalId, msg.sender, _support, votingPower);
    }

    /** ----------------------------------------
     *  Tally Votes for Main Chain (Relayer calls this)
     * ---------------------------------------- */
    function tallyVotes(bytes32 proposalId) external nonReentrant {
        if (msg.sender != relayer && msg.sender != owner()) revert OnlyRelayer();
        
        Proposal storage proposal = proposals[proposalId];
        
        if (block.timestamp < proposal.endTime) revert VotingPeriodNotEnded();
        if (proposal.voteTallied) revert VoteAlreadyFinalized();
        
        proposal.voteTallied = true;
        
        emit VotesTallied(proposalId, proposal.yesVotes, proposal.noVotes);
    }
    
    /** ----------------------------------------
     *  Update Proposal Status (Relayer updates from main chain)
     * ---------------------------------------- */
    function updateProposalStatus(bytes32 proposalId, ProposalStatus _status) external {
        if (msg.sender != relayer) revert OnlyRelayer();
        
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ExecutionFailed();
        
        proposal.status = _status;
        
        emit ProposalStatusUpdated(proposalId, _status);
    }

    /** ----------------------------------------
     *  Utility Functions
     * ---------------------------------------- */
    function getProposalCount() external view returns (uint256) {
        return proposalIds.length;
    }

    function getAllProposalIds() external view returns (bytes32[] memory) {
        return proposalIds;
    }

    function getVotingPower(address _voter) external view returns (uint256) {
        return governanceToken.getVotes(_voter);
    }
    
    function getChainId() external view returns (string memory) {
        return chainId;
    }
}