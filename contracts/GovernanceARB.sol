// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract GovernanceARB is ReentrancyGuard {
    ERC20Votes public pgvToken; // Separate token on Arbitrum
    address public relayer; // Trusted relayer address

    enum ProposalStatus { Pending, Accepted, Rejected }

    struct Proposal {
        uint256 id;
        string title;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 startTime;
        uint256 endTime;
        ProposalStatus status;
        uint256 snapshotBlock; // Snapshot on Arbitrum
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // Custom errors
    error OnlyRelayer();
    error ProposalAlreadyExists();
    error VotingPeriodEnded();
    error AlreadyVoted();
    error NoVotingPower();
    error ExecutionFailed();

    event ProposalMirrored(
        uint256 indexed id,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime,
        uint256 snapshotBlock
    );

    event ProposalExecuted(uint256 indexed id, ProposalStatus status);

    constructor(address _pgvToken, address _relayer) {
        pgvToken = ERC20Votes(_pgvToken);
        relayer = _relayer;
    }

    /**
     * @dev Mirror proposal from BSC (callable only by relayer)
     */
    function mirrorProposal(
        uint256 _id,
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime
    ) external nonReentrant {
        if (msg.sender != relayer) revert OnlyRelayer();
        if (proposals[_id].startTime != 0) revert ProposalAlreadyExists();

        uint256 snapshotBlock = block.number - 1; // Snapshot at previous block

        proposals[_id] = Proposal({
            id: _id,
            title: _title,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: _startTime,
            endTime: _endTime,
            status: ProposalStatus.Pending,
            snapshotBlock: snapshotBlock
        });

        emit ProposalMirrored(_id, _title, _description, _startTime, _endTime, snapshotBlock);
    }

    /**
     * @dev Vote using Arbitrum token balance at snapshot
     */
    function vote(uint256 _id, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[_id];
        
        if (block.timestamp >= proposal.endTime) revert VotingPeriodEnded();
        if (hasVoted[_id][msg.sender]) revert AlreadyVoted();

        uint256 votingPower = pgvToken.getPastVotes(msg.sender, proposal.snapshotBlock);
        if (votingPower == 0) revert NoVotingPower();

        if (_support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }

        hasVoted[_id][msg.sender] = true;
    }

    /**
     * @dev Execute proposal after voting ends
     */
    function executeProposal(uint256 _id) external nonReentrant {
        Proposal storage proposal = proposals[_id];
        
        if (block.timestamp < proposal.endTime) revert VotingPeriodEnded();
        if (proposal.status != ProposalStatus.Pending) revert ExecutionFailed();

        proposal.status = (proposal.yesVotes > proposal.noVotes)
            ? ProposalStatus.Accepted
            : ProposalStatus.Rejected;

        emit ProposalExecuted(_id, proposal.status);
    }

    /**
     * @dev Check voting power for a proposal
     */
    function getVotingPower(uint256 _id, address _voter) external view returns (uint256) {
        return pgvToken.getPastVotes(_voter, proposals[_id].snapshotBlock);
    }
}