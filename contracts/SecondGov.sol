// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract GovernanceARB {
    struct Proposal {
        uint256 id;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    event ProposalCreated(uint256 indexed id, string description);

    // Only called by relayer
    function createProposal(uint256 _id, string memory _description) external {
        require(proposals[_id].id == 0, "Proposal exists");
        proposals[_id] = Proposal(_id, _description, 0, 0);
        proposalCount++;
        emit ProposalCreated(_id, _description);
    }

    // Local voting only
    function voteYes(uint256 _id) external {
        proposals[_id].yesVotes++;
    }

    function voteNo(uint256 _id) external {
        proposals[_id].noVotes++;
    }
}
