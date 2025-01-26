// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract GovernanceARB {
    address public relayer;
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

    event ProposalMirrored(
        uint256 indexed id,
        string description,
        uint256 startTime,
        uint256 endTime
    );

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only relayer");
        _;
    }

    constructor(address _relayer) {
        relayer = _relayer;
    }

    // Only called by relayer to mirror BSC proposals
    function mirrorProposal(
        uint256 _id,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyRelayer {
        require(proposals[_id].startTime == 0, "Proposal exists");

        proposals[_id] = Proposal({
            id: _id,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: _startTime,
            endTime: _endTime,
            executed: false
        });

        emit ProposalMirrored(_id, _description, _startTime, _endTime);
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
