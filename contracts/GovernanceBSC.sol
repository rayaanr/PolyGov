// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract GovernanceBSC is ReentrancyGuard {
    ERC20Votes public pgvToken;

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
        uint256 snapshotBlock; // Snapshot block for voting power
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
        uint256 endTime,
        uint256 snapshotBlock
    );
    event ProposalExecuted(uint256 indexed id, ProposalStatus status);

    constructor(address _pgvToken) {
        pgvToken = ERC20Votes(_pgvToken);
    }

    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _durationDays
    ) external nonReentrant {
        require(_durationDays >= 1, "Duration too short");

        // Check current balance (not snapshot) for proposal creation
        uint256 currentBalance = pgvToken.balanceOf(msg.sender);
        if (currentBalance < 100 * 10 ** 18) {
            revert InsufficientProposerBalance();
        }

        proposalCount++;
        uint256 snapshotBlock = block.number; // Current block for voting snapshots

        proposals[proposalCount] = Proposal({
            id: proposalCount,
            title: _title,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + (_durationDays * 1 days),
            status: ProposalStatus.Pending,
            snapshotBlock: snapshotBlock
        });

        emit ProposalCreated(
            proposalCount,
            _title,
            _description,
            block.timestamp,
            block.timestamp + (_durationDays * 1 days),
            snapshotBlock
        );
    }

    function getVotingPower(
        uint256 _proposalId,
        address _voter
    ) external view returns (uint256) {
        if (_proposalId == 0 || _proposalId > proposalCount) {
            revert("Invalid proposal ID");
        }
        Proposal storage proposal = proposals[_proposalId];
        return pgvToken.getPastVotes(_voter, proposal.snapshotBlock);
    }

    function vote(uint256 _id, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[_id];

        if (block.timestamp >= proposal.endTime) {
            revert VotingPeriodEnded();
        }
        if (hasVoted[_id][msg.sender]) {
            revert AlreadyVoted();
        }

        // Use snapshot block for voting power check
        uint256 votingPower = pgvToken.getPastVotes(
            msg.sender,
            proposal.snapshotBlock
        );
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

    function executeProposal(uint256 _id) external nonReentrant {
        Proposal storage proposal = proposals[_id];

        if (proposal.status != ProposalStatus.Pending) {
            revert ProposalAlreadyExecuted();
        }
        if (block.timestamp < proposal.endTime) {
            revert VotingPeriodEnded();
        }

        proposal.status = (proposal.yesVotes > proposal.noVotes)
            ? ProposalStatus.Accepted
            : ProposalStatus.Rejected;

        emit ProposalExecuted(_id, proposal.status);
    }
}
