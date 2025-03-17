// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MainGovernance is ReentrancyGuard, Ownable {
    ERC20Votes public governanceToken;
    address public relayer;
    bool public isMainChain = true; // This flag identifies this as the main chain

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
        uint256 finalYesVotes;
        uint256 finalNoVotes;
        bool voteTallyFinalized;
    }

    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    bytes32[] public proposalIds; // Store all proposal UUIDs for querying

    // Track secondary chain vote summaries
    mapping(bytes32 => mapping(string => VoteSummary))
        public secondaryChainVotes;
    string[] public registeredChains;

    struct VoteSummary {
        uint256 yesVotes;
        uint256 noVotes;
        bool collected;
    }

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
    error ChainAlreadyRegistered();
    error ChainNotRegistered();

    event ProposalCreated(
        bytes32 indexed id,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime,
        uint256 snapshotTimestamp
    );

    event VoteTallyFinalized(
        bytes32 indexed id,
        uint256 totalYesVotes,
        uint256 totalNoVotes
    );

    event ProposalExecuted(bytes32 indexed id, ProposalStatus status);

    event Voted(
        bytes32 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    event TokenUpdated(address indexed newToken);

    event SecondaryChainVotesCollected(
        bytes32 indexed proposalId,
        string chainId,
        uint256 yesVotes,
        uint256 noVotes
    );

    event ChainRegistered(string chainId);

    struct GovernanceConfig {
        address governanceToken;
        address relayer;
    }

    constructor(GovernanceConfig memory config) Ownable(msg.sender) {
        require(config.governanceToken != address(0), "Invalid token address");
        require(config.relayer != address(0), "Invalid relayer address");

        governanceToken = ERC20Votes(config.governanceToken);
        relayer = config.relayer;
    }

    /** --------------------------------------
     *  Admin: Update Governance Token Address
     * -------------------------------------- */
    function updateGovernanceToken(address _newToken) external onlyOwner {
        require(_newToken != address(0), "Invalid token address");
        governanceToken = ERC20Votes(_newToken);
        emit TokenUpdated(_newToken);
    }

    /** --------------------------------------
     *  Admin: Register Secondary Chain
     * -------------------------------------- */
    mapping(string => bool) public registeredChains;

    function registerSecondaryChain(string memory chainId) external onlyOwner {
        require(!registeredChains[chainId], "Chain already registered");
        registeredChains[chainId] = true;
    }

    /** --------------------------------------
     *  Create Proposal with Unique UUID (Timestamp-Based Snapshot)
     * -------------------------------------- */
    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _durationHours
    ) external nonReentrant {
        require(_durationHours >= 1, "Duration too short");

        uint256 votingPower = governanceToken.getVotes(msg.sender);
        if (votingPower < 100 * 10 ** 18) {
            revert NoVotingPower();
        }

        // Take a snapshot of the voting power timestamp
        uint256 snapshotTimestamp = block.timestamp;

        // Generate the unique proposal ID (UUID)
        uint256 nonce = proposalIds.length + block.number;
        bytes32 proposalId = keccak256(abi.encodePacked(nonce, msg.sender));

        proposals[proposalId] = Proposal({
            id: proposalId,
            title: _title,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + (_durationHours * 1 hours),
            snapshotTimestamp: snapshotTimestamp,
            snapshotBlock: block.number - 1, // Default to current chain block
            status: ProposalStatus.Pending,
            finalYesVotes: 0,
            finalNoVotes: 0,
            voteTallyFinalized: false
        });

        proposalIds.push(proposalId);

        emit ProposalCreated(
            proposalId,
            _title,
            _description,
            block.timestamp,
            block.timestamp + (_durationHours * 1 hours),
            snapshotTimestamp
        );
    }

    /** ----------------------------------------
     *  Voting Logic (Timestamp-Based Snapshot)
     * ---------------------------------------- */
    function vote(bytes32 proposalId, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];

        if (block.timestamp >= proposal.endTime) revert VotingPeriodEnded();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        // Use past voting power from snapshot
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
     *  Collect Secondary Chain Votes (Relayer only)
     * ---------------------------------------- */
    function collectSecondaryChainVotes(
        bytes32 proposalId,
        string memory chainId,
        uint256 yesVotes,
        uint256 noVotes
    ) external {
        if (msg.sender != relayer) revert OnlyRelayer();

        // Verify this is a registered chain
        bool isRegistered = false;
        for (uint i = 0; i < registeredChains.length; i++) {
            if (
                keccak256(bytes(registeredChains[i])) ==
                keccak256(bytes(chainId))
            ) {
                isRegistered = true;
                break;
            }
        }

        if (!isRegistered) revert ChainNotRegistered();

        Proposal storage proposal = proposals[proposalId];
        if (block.timestamp < proposal.endTime) revert VotingPeriodNotEnded();

        // Store the votes from this secondary chain
        secondaryChainVotes[proposalId][chainId] = VoteSummary({
            yesVotes: yesVotes,
            noVotes: noVotes,
            collected: true
        });

        emit SecondaryChainVotesCollected(
            proposalId,
            chainId,
            yesVotes,
            noVotes
        );
    }

    /** ----------------------------------------
     *  Finalize Votes (Combines main chain + all secondary chain votes)
     * ---------------------------------------- */
    function finalizeVoteTally(bytes32 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        if (block.timestamp < proposal.endTime) revert VotingPeriodNotEnded();
        if (proposal.voteTallyFinalized) revert VoteAlreadyFinalized();

        // Start with main chain votes
        uint256 totalYesVotes = proposal.yesVotes;
        uint256 totalNoVotes = proposal.noVotes;

        // Add votes from all secondary chains
        for (uint i = 0; i < registeredChains.length; i++) {
            string memory chainId = registeredChains[i];
            VoteSummary storage summary = secondaryChainVotes[proposalId][
                chainId
            ];

            if (summary.collected) {
                totalYesVotes += summary.yesVotes;
                totalNoVotes += summary.noVotes;
            }
        }

        proposal.finalYesVotes = totalYesVotes;
        proposal.finalNoVotes = totalNoVotes;
        proposal.voteTallyFinalized = true;

        emit VoteTallyFinalized(proposalId, totalYesVotes, totalNoVotes);
    }

    /** ----------------------------------------
     *  Execute Proposal
     * ---------------------------------------- */
    function executeProposal(bytes32 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];

        if (block.timestamp < proposal.endTime) revert VotingPeriodNotEnded();
        if (!proposal.voteTallyFinalized) revert VoteNotFinalized();
        if (proposal.status != ProposalStatus.Pending) revert ExecutionFailed();

        proposal.status = (proposal.finalYesVotes > proposal.finalNoVotes)
            ? ProposalStatus.Accepted
            : ProposalStatus.Rejected;

        emit ProposalExecuted(proposalId, proposal.status);
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

    function getRegisteredChains() external view returns (string[] memory) {
        return registeredChains;
    }
}
