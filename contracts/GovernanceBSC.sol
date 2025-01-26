// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GovernanceBSC is Ownable, ReentrancyGuard {
    IERC20 public pgvToken;

    struct Proposal {
        uint256 id;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;

    event ProposalCreated(
        uint256 indexed id,
        string description,
        uint256 startTime,
        uint256 endTime
    );

    constructor(address _pgvToken) Ownable(msg.sender) {
        pgvToken = IERC20(_pgvToken);
    }

    function createProposal(string memory _description) external onlyOwner {
        proposalCount++;
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + 3 days,
            executed: false
        });

        emit ProposalCreated(
            proposalCount,
            _description,
            block.timestamp,
            block.timestamp + 3 days
        );
    }

    function vote(uint256 _id, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[_id];
        require(block.timestamp < proposal.endTime, "Voting ended");
        require(!hasVoted[_id][msg.sender], "Already voted");

        // Check voter's PGV balance
        uint256 balance = pgvToken.balanceOf(msg.sender);
        require(balance > 0, "No PGV tokens to vote");

        if (_support) proposal.yesVotes += balance;
        else proposal.noVotes += balance;

        hasVoted[_id][msg.sender] = true;
    }

    function executeProposal(uint256 _id) external nonReentrant {
        Proposal storage proposal = proposals[_id];
        require(block.timestamp >= proposal.endTime, "Voting ongoing");
        require(!proposal.executed, "Already executed");

        proposal.executed = true;
    }
}
