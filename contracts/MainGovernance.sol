// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MainGovernance
 * @dev Main governance contract that coordinates with secondary chains
 */
contract MainGovernance is Ownable, ReentrancyGuard {
    ERC20Votes public governanceToken;
    address public relayer;
    bool public constant isMainChain = true;
    uint256 proposalNonce;

    enum ProposalStatus {
        Pending,
        Accepted,
        Rejected
    }

    struct Proposal {
        bytes32 id;
        string title;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 startTime;
        uint256 endTime;
        ProposalStatus status;
        uint256 finalYesVotes;
        uint256 finalNoVotes;
        bool voteTallyFinalized;
    }

    // Storage
    mapping(bytes32 => Proposal) proposals;
    mapping(bytes32 => mapping(address => bool)) hasVoted;
    bytes32[] proposalIds;

    // Secondary chain management
    mapping(string => bool) registeredChains;
    string[] chainList;

    // Secondary chain votes tracking
    // mapping(proposalId => mapping(chainId => VoteSummary))
    mapping(bytes32 => mapping(string => VoteSummary)) secondaryChainVotes;

    struct VoteSummary {
        uint256 yesVotes;
        uint256 noVotes;
        bool collected;
    }

    // Events
    event ProposalCreated(bytes32 indexed id, string title, uint256 endTime);
    event RelayerUpdated(address indexed newRelayer);
    event Voted(
        bytes32 indexed proposalId,
        address voter,
        bool support,
        uint256 weight
    );
    event VoteTallyFinalized(
        bytes32 indexed id,
        uint256 totalYesVotes,
        uint256 totalNoVotes
    );
    event ProposalExecuted(bytes32 indexed id, ProposalStatus status);
    event SecondaryChainVotesCollected(
        bytes32 indexed proposalId,
        string chainId,
        uint256 yesVotes,
        uint256 noVotes
    );
    event ChainRegistered(string chainId);

    // Modifiers
    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only relayer can call");
        _;
    }

    constructor(address _token, address _relayer) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_relayer != address(0), "Invalid relayer address");
        governanceToken = ERC20Votes(_token);
        relayer = _relayer;
    }

    /**
     * @dev Update the relayer address
     */
    function updateRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "Invalid relayer address");
        relayer = _newRelayer;
        emit RelayerUpdated(_newRelayer);
    }

    /**
     * @dev Register a secondary chain
     */
    function addSecondaryChain(string memory chainId) external onlyOwner {
        require(!registeredChains[chainId], "Chain already registered");
        registeredChains[chainId] = true;
        chainList.push(chainId);
        emit ChainRegistered(chainId);
    }

    /**
     * @dev Create a new proposal
     */
    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _durationMinutes
    ) external {
        // This is only for testing purposes
        require(_durationMinutes >= 5, "Duration too short");

        // Check proposal creator has minimum voting power
        uint256 votingPower = governanceToken.getVotes(msg.sender);
        require(votingPower >= 100 * 10 ** 18, "Insufficient voting power");

        // Generate proposal ID
        proposalNonce++;
        bytes32 proposalId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, proposalNonce)
        );

        // Create proposal
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.title = _title;
        newProposal.description = _description;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + (_durationMinutes * 1 minutes);
        newProposal.status = ProposalStatus.Pending;

        proposalIds.push(proposalId);

        emit ProposalCreated(proposalId, _title, newProposal.endTime);
    }

    /**
     * @dev Vote on a proposal
     */
    function castVote(bytes32 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.startTime > 0, "Proposal doesn't exist");
        require(block.timestamp < proposal.endTime, "Voting period ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        // Get voting power from snapshot
        uint256 votingPower = governanceToken.getPastVotes(
            msg.sender,
            proposal.startTime
        );
        require(votingPower > 0, "No voting power");

        // Record vote
        if (support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }

        hasVoted[proposalId][msg.sender] = true;

        emit Voted(proposalId, msg.sender, support, votingPower);
    }

    /**
     * @dev Collect votes from secondary chains
     */
    function collectSecondaryChainVotes(
        bytes32 proposalId,
        string memory chainId,
        uint256 yesVotes,
        uint256 noVotes
    ) external onlyRelayer {
        require(registeredChains[chainId], "Chain not registered");
        require(
            block.timestamp >= proposals[proposalId].endTime,
            "Voting period not ended"
        );
        require(
            !secondaryChainVotes[proposalId][chainId].collected,
            "Votes already collected"
        );

        // Store the votes
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

    /**
     * @dev Finalize vote tally combining main and secondary chain votes
     */
    function finalizeProposalVotes(bytes32 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.startTime > 0, "Proposal doesn't exist");
        // Wait for cooldown period of 1 mins after voting ends, This is to ensure that the relayer has enough time to collect votes from all secondary chains
        require(block.timestamp >= proposal.endTime + 1 minutes, "Cooldown period not ended");
        require(block.timestamp >= proposal.endTime, "Voting period not ended");
        require(!proposal.voteTallyFinalized, "Vote already finalized");

        // Start with main chain votes
        uint256 totalYesVotes = proposal.yesVotes;
        uint256 totalNoVotes = proposal.noVotes;

        // Add votes from all secondary chains
        for (uint i = 0; i < chainList.length; i++) {
            string memory chainId = chainList[i];

            // Skip chains that are no longer registered
            if (!registeredChains[chainId]) continue;

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

        processProposalExecution(proposalId);

        emit VoteTallyFinalized(proposalId, totalYesVotes, totalNoVotes);
    }

    /**
     * @dev Execute proposal after votes are finalized
     */
    function processProposalExecution(bytes32 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];

        require(block.timestamp >= proposal.endTime, "Voting period not ended");
        require(proposal.voteTallyFinalized, "Vote not finalized");
        require(proposal.status == ProposalStatus.Pending, "Already executed");

        // Set the result
        proposal.status = proposal.finalYesVotes > proposal.finalNoVotes
            ? ProposalStatus.Accepted
            : ProposalStatus.Rejected;

        emit ProposalExecuted(proposalId, proposal.status);
    }

    /**
     * @dev Get all proposal IDs
     */
    function getProposalIds() external view returns (bytes32[] memory) {
        return proposalIds;
    }

    /**
     * @dev Get proposal details
     */
    function getProposalDetails(
        bytes32 proposalId
    ) external view returns (Proposal memory) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.startTime > 0, "Proposal doesn't exist");
        return proposal;
    }

    /**
     * @dev Check if user has voted on a proposal
     */
    function hadUserVoted(
        bytes32 proposalId,
        address user
    ) external view returns (bool) {
        return hasVoted[proposalId][user];
    }

    /**
     * @dev Get the voting power of a user at the time of proposal creation
     */
    function getUserVotingPowerAtProposal(
        bytes32 proposalId,
        address user
    ) external view returns (uint256) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.startTime > 0, "Proposal doesn't exist");
        return governanceToken.getPastVotes(user, proposal.startTime);
    }

    /**
     * @dev Get registered chains
     */
    function getRegisteredChains() external view returns (string[] memory) {
        return chainList;
    }
}
