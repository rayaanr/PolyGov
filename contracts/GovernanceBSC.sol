// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract GovernanceBSC {
    address public owner;
    uint256 public votingPeriod = 3 days;

    enum Vote {
        NONE,
        YES,
        NO
    }

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

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createProposal(string memory _description) external onlyOwner {
        proposalCount++;
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + votingPeriod,
            executed: false
        });

        emit ProposalCreated(
            proposalCount,
            _description,
            block.timestamp,
            block.timestamp + votingPeriod
        );
    }

    function vote(uint256 _id, Vote _vote) external {
        Proposal storage proposal = proposals[_id];
        require(block.timestamp < proposal.endTime, "Voting ended");
        require(!hasVoted[_id][msg.sender], "Already voted");

        if (_vote == Vote.YES) proposal.yesVotes++;
        else if (_vote == Vote.NO) proposal.noVotes++;

        hasVoted[_id][msg.sender] = true;
    }

    function executeProposal(uint256 _id) external {
        Proposal storage proposal = proposals[_id];
        require(block.timestamp >= proposal.endTime, "Voting ongoing");
        require(!proposal.executed, "Already executed");

        proposal.executed = true;
    }
}
