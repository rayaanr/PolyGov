// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/**
 * @title SecondaryGovernance
 * @dev Secondary chain governance contract that mirrors proposals from main chain
 */
contract SecondaryGovernance is Ownable {
    ERC20Votes public governanceToken;
    address public relayer;
    string public chainId;
    bool public constant isMainChain = false;

    enum ProposalStatus {
        Pending,
        Accepted,
        Rejected
    }

    struct Proposal {
        bytes32 id;
        string title;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 snapshotBlock;
        ProposalStatus status;
        bool voteTallied;
    }

    // Storage
    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    bytes32[] public proposalIds;

    // Events
    event ProposalMirrored(bytes32 indexed id, string title, uint256 endTime);
    event Voted(
        bytes32 indexed proposalId,
        address voter,
        bool support,
        uint256 weight
    );
    event VotesTallied(
        bytes32 indexed proposalId,
        uint256 yesVotes,
        uint256 noVotes
    );
    event ProposalStatusUpdated(
        bytes32 indexed proposalId,
        ProposalStatus status
    );

    // Modifiers
    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only relayer can call");
        _;
    }

    constructor(
        address _token,
        address _relayer,
        string memory _chainId
    ) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_relayer != address(0), "Invalid relayer address");
        require(bytes(_chainId).length > 0, "Invalid chain ID");

        governanceToken = ERC20Votes(_token);
        relayer = _relayer;
        chainId = _chainId;
    }

    /**
     * @dev Update the relayer address
     */
    function updateRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "Invalid relayer address");
        relayer = _newRelayer;
    }

    /**
     * @dev Mirror a proposal from the main chain
     */
    function mirrorProposal(
        bytes32 proposalId,
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _snapshotTimestamp
    ) external onlyRelayer {
        require(
            proposals[proposalId].startTime == 0,
            "Proposal already exists"
        );

        // Find closest block to snapshot timestamp
        uint256 closestBlock = findClosestBlockToTimestamp(_snapshotTimestamp);

        proposals[proposalId] = Proposal({
            id: proposalId,
            title: _title,
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            startTime: _startTime,
            endTime: _endTime,
            snapshotBlock: closestBlock,
            status: ProposalStatus.Pending,
            voteTallied: false
        });

        proposalIds.push(proposalId);

        emit ProposalMirrored(proposalId, _title, _endTime);
    }

    /**
     * @dev Find closest block to a timestamp (simplified version)
     */
    function findClosestBlockToTimestamp(
        uint256 timestamp
    ) internal view returns (uint256) {
        uint256 currentBlock = block.number;
        uint256 currentTime = block.timestamp;

        // Estimate based on average block time (assumes 2 seconds per block)
        uint256 blockTimeDiff = (currentTime - timestamp) / 2;

        if (currentBlock <= blockTimeDiff) {
            return 1;
        }

        return currentBlock - blockTimeDiff;
    }

    /**
     * @dev Vote on a proposal
     */
    function vote(bytes32 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.startTime > 0, "Proposal doesn't exist");
        require(block.timestamp < proposal.endTime, "Voting period ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        // Get voting power from snapshot
        uint256 votingPower = governanceToken.getPastVotes(
            msg.sender,
            proposal.snapshotBlock
        );
        require(votingPower > 0, "No voting power");

        // Record vote
        if (support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }

        hasVoted[proposalId][msg.sender] = true;

        emit Voted(proposalId, msg.sender, support, votingPower);
    }

    /**
     * @dev Tally votes to be collected by the relayer
     */
    function tallyVotes(bytes32 proposalId) external onlyRelayer {
        Proposal storage proposal = proposals[proposalId];

        require(block.timestamp >= proposal.endTime, "Voting period not ended");
        require(!proposal.voteTallied, "Votes already tallied");

        proposal.voteTallied = true;

        emit VotesTallied(proposalId, proposal.yesVotes, proposal.noVotes);
    }

    /**
     * @dev Update proposal status after main chain execution
     */
    function updateProposalStatus(
        bytes32 proposalId,
        ProposalStatus _status
    ) external onlyRelayer {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.startTime > 0, "Proposal doesn't exist");

        proposal.status = _status;

        emit ProposalStatusUpdated(proposalId, _status);
    }

    /**
     * @dev Get all proposal IDs
     */
    function getAllProposalIds() external view returns (bytes32[] memory) {
        return proposalIds;
    }

    /**
     * @dev Get chain ID
     */
    function getChainId() external view returns (string memory) {
        return chainId;
    }
}
