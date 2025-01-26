// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract GovernanceBSC {
    address public owner;

    struct Proposal {
        uint256 id;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    event ProposalCreated(uint256 indexed id, string description);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createProposal(string memory _description) external onlyOwner {
        proposalCount++;
        proposals[proposalCount] = Proposal(proposalCount, _description, 0, 0);
        emit ProposalCreated(proposalCount, _description);
    }

    // Local voting only
    function voteYes(uint256 _id) external {
        proposals[_id].yesVotes++;
    }

    function voteNo(uint256 _id) external {
        proposals[_id].noVotes++;
    }
}
