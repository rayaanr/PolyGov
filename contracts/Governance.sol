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
        uint256 id;
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

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;

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
        uint256 indexed id,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime
    );

    event ProposalMirrored(
        uint256 indexed id,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime
    );

    event VoteTallyFinalized(
        uint256 indexed id,
        uint256 totalYesVotes,
        uint256 totalNoVotes
    );

    event ProposalExecuted(uint256 indexed id, ProposalStatus status);

    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    constructor(address _pgvToken, address _relayer) {
        pgvToken = IERC20(_pgvToken);
        relayer = _relayer;
    }

    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _durationDays
    ) external nonReentrant {
        require(_durationDays >= 1, "Duration too short");
        
        uint256 currentBalance = pgvToken.balanceOf(msg.sender);
        if (currentBalance < 100 * 10**18) {
            revert NoVotingPower();
        }

        proposalCount++;

        proposals[proposalCount] = Proposal({
            id: proposalCount,
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

        emit ProposalCreated(
            proposalCount,
            _title,
            _description,
            block.timestamp,
            block.timestamp + (_durationDays * 1 days)
        );
    }

    function mirrorProposal(
        uint256 _id,
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime
    ) external nonReentrant {
        if (msg.sender != relayer) revert OnlyRelayer();
        if (proposals[_id].startTime != 0) revert ProposalAlreadyExists();

        proposals[_id] = Proposal({
            id: _id,
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

        emit ProposalMirrored(_id, _title, _description, _startTime, _endTime);
    }

    function vote(uint256 _id, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[_id];

        if (block.timestamp >= proposal.endTime) revert VotingPeriodEnded();
        if (hasVoted[_id][msg.sender]) revert AlreadyVoted();

        uint256 votingPower = pgvToken.balanceOf(msg.sender);
        if (votingPower == 0) revert NoVotingPower();

        if (_support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }

        hasVoted[_id][msg.sender] = true;
        
        emit Voted(_id, msg.sender, _support, votingPower);
    }

    function finalizeVoteTally(
        uint256 _id,
        uint256 _totalYesVotes,
        uint256 _totalNoVotes
    ) external {
        if (msg.sender != relayer) revert OnlyRelayer();
        
        Proposal storage proposal = proposals[_id];
        
        if (block.timestamp < proposal.endTime) revert VotingPeriodNotEnded();
        if (proposal.voteTallyFinalized) revert VoteAlreadyFinalized();
        
        proposal.finalYesVotes = _totalYesVotes;
        proposal.finalNoVotes = _totalNoVotes;
        proposal.voteTallyFinalized = true;

        emit VoteTallyFinalized(_id, _totalYesVotes, _totalNoVotes);
    }

    function executeProposal(uint256 _id) external nonReentrant {
        Proposal storage proposal = proposals[_id];

        if (block.timestamp < proposal.endTime) revert VotingPeriodNotEnded();
        if (!proposal.voteTallyFinalized) revert VoteNotFinalized();
        if (proposal.status != ProposalStatus.Pending) revert ExecutionFailed();

        proposal.status = (proposal.finalYesVotes > proposal.finalNoVotes)
            ? ProposalStatus.Accepted
            : ProposalStatus.Rejected;

        emit ProposalExecuted(_id, proposal.status);
    }

    function getVotingPower(address _voter) external view returns (uint256) {
        return pgvToken.balanceOf(_voter);
    }
}