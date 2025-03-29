// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SecondaryGovernance
 * @dev Secondary chain governance contract that mirrors proposals from main chain
 */
contract SecondaryGovernance is Ownable, ReentrancyGuard {
    ERC20Votes public governanceToken;
    address public relayer;
    string public chainId;

    enum ProposalStatus {
        Pending,
        Accepted,
        Rejected
    }

    struct Proposal {
        bytes32 id;
        string title;
        string ipfsHash;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 startTime;
        uint256 endTime;
        address proposer;
        ProposalStatus status;
        bool voteFinalized;
    }

    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    bytes32[] public proposalIds;

    // ===================== Events ===================== //
    event ProposalMirrored(bytes32 indexed id, string title, uint256 endTime);
    event RelayerUpdated(address indexed newRelayer);
    event Voted(
        bytes32 indexed proposalId,
        address voter,
        bool support,
        uint256 weight
    );
    event VotesTallied(
        bytes32 indexed proposalId,
        uint256 yesVotes,
        uint256 noVotes
    );
    event ProposalStatusUpdated(
        bytes32 indexed proposalId,
        ProposalStatus status
    );

    // ===================== Errors ===================== //
    error ProposalNotFound(bytes32 proposalId);
    error ProposalAlreadyExists(bytes32 proposalId);
    error AlreadyVoted(address voter, bytes32 proposalId);
    error VotePeriodEnded(bytes32 proposalId);
    error VoteNotFinalized(bytes32 proposalId);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only relayer can call");
        _;
    }

    constructor(
        address _token,
        address _relayer,
        string memory _chainId
    ) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_relayer != address(0), "Invalid relayer address");
        require(bytes(_chainId).length > 0, "Invalid chain ID");

        governanceToken = ERC20Votes(_token);
        relayer = _relayer;
        chainId = _chainId;
    }

    /// @notice Update the trusted relayer address
    function updateRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "Invalid relayer address");
        relayer = _newRelayer;
        emit RelayerUpdated(_newRelayer);
    }

    /// @notice Mirror a proposal from the main chain
    function mirrorProposal(
        bytes32 proposalId,
        string memory _title,
        string memory _ipfsHash,
        uint256 _startTime,
        uint256 _endTime,
        address _proposer
    ) external onlyRelayer {
        if (proposals[proposalId].startTime > 0)
            revert ProposalAlreadyExists(proposalId);

        proposals[proposalId] = Proposal({
            id: proposalId,
            title: _title,
            ipfsHash: _ipfsHash,
            yesVotes: 0,
            noVotes: 0,
            startTime: _startTime,
            endTime: _endTime,
            proposer: _proposer,
            status: ProposalStatus.Pending,
            voteFinalized: false
        });

        proposalIds.push(proposalId);
        emit ProposalMirrored(proposalId, _title, _endTime);
    }

    /// @notice Cast a vote on a mirrored proposal
    function castVote(bytes32 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ProposalNotFound(proposalId);
        if (block.timestamp >= proposal.endTime)
            revert VotePeriodEnded(proposalId);
        if (hasVoted[proposalId][msg.sender])
            revert AlreadyVoted(msg.sender, proposalId);

        uint256 votingPower = governanceToken.getPastVotes(
            msg.sender,
            proposal.startTime
        );
        require(votingPower > 0, "No voting power");

        if (support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }

        hasVoted[proposalId][msg.sender] = true;
        emit Voted(proposalId, msg.sender, support, votingPower);
    }

    /// @notice Finalize voting results for relayer collection
    function finalizeVotes(bytes32 proposalId) external onlyRelayer {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ProposalNotFound(proposalId);
        require(block.timestamp >= proposal.endTime, "Voting period not ended");
        require(!proposal.voteFinalized, "Votes already finalized");

        proposal.voteFinalized = true;

        emit VotesTallied(proposalId, proposal.yesVotes, proposal.noVotes);
    }

    /// @notice Update status from main chain result
    function updateProposalStatus(
        bytes32 proposalId,
        ProposalStatus _status
    ) external onlyRelayer {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ProposalNotFound(proposalId);
        if (!proposal.voteFinalized) revert VoteNotFinalized(proposalId);

        proposal.status = _status;
        emit ProposalStatusUpdated(proposalId, _status);
    }

    // ===================== VIEW FUNCTIONS ===================== //

    /// @notice Get all proposal IDs
    function getProposalIds() external view returns (bytes32[] memory) {
        return proposalIds;
    }

    /// @notice Get details of a proposal
    function getProposalDetails(
        bytes32 proposalId
    ) external view returns (Proposal memory) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ProposalNotFound(proposalId);
        return proposal;
    }

    /// @notice Check if user has voted
    function hasUserVoted(
        bytes32 proposalId,
        address user
    ) external view returns (bool) {
        return hasVoted[proposalId][user];
    }

    /// @notice Get user's voting power at proposal start
    function getUserVotingPowerAtProposal(
        bytes32 proposalId,
        address user
    ) external view returns (uint256) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ProposalNotFound(proposalId);
        return governanceToken.getPastVotes(user, proposal.startTime);
    }

    /// @notice Get this chain's ID
    function getChainId() external view returns (string memory) {
        return chainId;
    }
}
