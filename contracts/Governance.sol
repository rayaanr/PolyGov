// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Governance is ReentrancyGuard {
    IERC20 public pgvToken;
    address public relayer;

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
        ProposalStatus status;
        uint256 finalYesVotes;
        uint256 finalNoVotes;
        bool voteTallyFinalized;
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

    event ProposalCreated(
        bytes32 indexed id,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime
    );

    event ProposalMirrored(
        bytes32 indexed id,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime
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

    constructor(address _pgvToken, address _relayer) {
        pgvToken = IERC20(_pgvToken);
        relayer = _relayer;
    }

    /** --------------------------------------
     *  Create Proposal with Unique UUID
     * -------------------------------------- */
    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _durationDays
    ) external nonReentrant {
        require(_durationDays >= 1, "Duration too short");

        uint256 currentBalance = pgvToken.balanceOf(msg.sender);
        if (currentBalance < 100 * 10 ** 18) {
            revert NoVotingPower();
        }

        // Generate the unique proposal ID (UUID)
        bytes32 proposalId = keccak256(
            abi.encodePacked(
                block.timestamp,
                msg.sender,
                proposalIds.length,
                block.chainid
            )
        );

        proposals[proposalId] = Proposal({
            id: proposalId,
            title: _title,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + (_durationDays * 1 days),
            status: ProposalStatus.Pending,
            finalYesVotes: 0,
            finalNoVotes: 0,
            voteTallyFinalized: false
        });

        // Store the UUID in the array for easy querying
        proposalIds.push(proposalId);

        emit ProposalCreated(
            proposalId,
            _title,
            _description,
            block.timestamp,
            block.timestamp + (_durationDays * 1 days)
        );
    }

    /** ----------------------------------------
     *  Mirror Proposal (for relayer only)
     * ---------------------------------------- */
    function mirrorProposal(
        bytes32 proposalId,
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime
    ) external nonReentrant {
        if (msg.sender != relayer) revert OnlyRelayer();
        if (proposals[proposalId].startTime != 0)
            revert ProposalAlreadyExists();

        proposals[proposalId] = Proposal({
            id: proposalId,
            title: _title,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: _startTime,
            endTime: _endTime,
            status: ProposalStatus.Pending,
            finalYesVotes: 0,
            finalNoVotes: 0,
            voteTallyFinalized: false
        });

        proposalIds.push(proposalId);

        emit ProposalMirrored(
            proposalId,
            _title,
            _description,
            _startTime,
            _endTime
        );
    }

    /** ----------------------------------------
     *  Voting Logic
     * ---------------------------------------- */
    function vote(bytes32 proposalId, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];

        if (block.timestamp >= proposal.endTime) revert VotingPeriodEnded();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        uint256 votingPower = pgvToken.balanceOf(msg.sender);
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
     *  Finalize Votes
     * ---------------------------------------- */
    function finalizeVoteTally(
        bytes32 proposalId,
        uint256 _totalYesVotes,
        uint256 _totalNoVotes
    ) external {
        if (msg.sender != relayer) revert OnlyRelayer();

        Proposal storage proposal = proposals[proposalId];

        if (block.timestamp < proposal.endTime) revert VotingPeriodNotEnded();
        if (proposal.voteTallyFinalized) revert VoteAlreadyFinalized();

        proposal.finalYesVotes = _totalYesVotes;
        proposal.finalNoVotes = _totalNoVotes;
        proposal.voteTallyFinalized = true;

        emit VoteTallyFinalized(proposalId, _totalYesVotes, _totalNoVotes);
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
        return pgvToken.balanceOf(_voter);
    }
}
