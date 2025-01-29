// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GovernanceBSC is ReentrancyGuard {
    IERC20 public pgvToken;

    enum ProposalStatus {
        Pending,
        Accepted,
        Rejected,
        Executed
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
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;

    // Custom errors for better logging
    error InsufficientProposerBalance();
    error VotingPeriodEnded();
    error AlreadyVoted();
    error NoVotingPower();
    error ProposalAlreadyExecuted();

    event ProposalCreated(
        uint256 indexed id,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime
    );

    event ProposalExecuted(uint256 indexed id, ProposalStatus status);

    constructor(address _pgvToken) {
        pgvToken = IERC20(_pgvToken);
    }

    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _durationDays
    ) external nonReentrant {
        require(_durationDays >= 1, "Duration too short");

        // Check current balance for proposal creation
        uint256 currentBalance = pgvToken.balanceOf(msg.sender);
        if (currentBalance < 100 * 10 ** 18) {
            revert InsufficientProposerBalance();
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
            status: ProposalStatus.Pending
        });

        emit ProposalCreated(
            proposalCount,
            _title,
            _description,
            block.timestamp,
            block.timestamp + (_durationDays * 1 days)
        );
    }

    function getVotingPower(address _voter) external view returns (uint256) {
        return pgvToken.balanceOf(_voter);
    }

    function vote(uint256 _id, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[_id];

        if (block.timestamp >= proposal.endTime) {
            revert VotingPeriodEnded();
        }
        if (hasVoted[_id][msg.sender]) {
            revert AlreadyVoted();
        }

        // Use current balance for voting power
        uint256 votingPower = pgvToken.balanceOf(msg.sender);
        if (votingPower == 0) {
            revert NoVotingPower();
        }

        if (_support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }

        hasVoted[_id][msg.sender] = true;
    }
}
