// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MainGovernance
 * @dev Main governance contract that coordinates with secondary chains and executes proposals
 */
contract MainGovernance is Ownable, ReentrancyGuard {
    ERC20Votes public governanceToken;
    address public relayer;
    uint256 public quorumVotes = 1000 * 10 ** 18;
    uint256 public constant MIN_CREATION_POWER = 100 * 10 ** 18;
    uint256 public constant MIN_VOTING_DURATION = 1;
    uint256 proposalNonce;

    enum ProposalStatus {
        Pending,
        Accepted,
        Rejected,
        Executed
    }

    struct Proposal {
        bytes32 id;
        string title;
        string ipfsHash;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 startTime;
        uint256 endTime;
        address proposer;
        ProposalStatus status;
        uint256 finalYesVotes;
        uint256 finalNoVotes;
        bool voteTallyFinalized;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        bool executed;
    }

    struct VoteSummary {
        uint256 yesVotes;
        uint256 noVotes;
        bool collected;
    }

    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    mapping(bytes32 => mapping(string => VoteSummary))
        public secondaryChainVotes;
    bytes32[] public proposalIds;

    mapping(string => bool) public registeredChains;
    string[] public chainList;

    // ===================== Events ===================== //
    event ProposalCreated(bytes32 indexed id, string title, uint256 endTime);
    event RelayerUpdated(address indexed newRelayer);
    event Voted(
        bytes32 indexed proposalId,
        address voter,
        bool support,
        uint256 weight
    );
    event VoteTallyFinalized(
        bytes32 indexed id,
        uint256 totalYesVotes,
        uint256 totalNoVotes
    );
    event ProposalExecuted(bytes32 indexed id, ProposalStatus status);
    event SecondaryChainVotesCollected(
        bytes32 indexed proposalId,
        string chainId,
        uint256 yesVotes,
        uint256 noVotes
    );
    event ChainRegistered(string chainId);
    event QuorumUpdated(uint256 newQuorum);

    // ===================== Custom Errors ===================== //
    error ProposalNotFound(bytes32 proposalId);
    error ProposalAlreadyFinalized(bytes32 proposalId);
    error ProposalAlreadyExecuted(bytes32 proposalId);
    error QuorumNotReached(uint256 totalVotes, uint256 quorumRequired);
    error VotesNotCollected(string chainId);
    error ExecutionFailed(address target, uint256 index);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only relayer can call");
        _;
    }

    constructor(address _token, address _relayer) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_relayer != address(0), "Invalid relayer address");
        governanceToken = ERC20Votes(_token);
        relayer = _relayer;
    }

    /// @notice Update the trusted relayer address
    function updateRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "Invalid relayer address");
        relayer = _newRelayer;
        emit RelayerUpdated(_newRelayer);
    }

    /// @notice Update the quorum threshold
    function updateQuorum(uint256 _newQuorum) external onlyOwner {
        require(_newQuorum > 0, "Quorum must be positive");
        quorumVotes = _newQuorum;
        emit QuorumUpdated(_newQuorum);
    }

    /// @notice Register a new secondary chain
    function addSecondaryChain(string memory chainId) external onlyOwner {
        require(!registeredChains[chainId], "Chain already registered");
        registeredChains[chainId] = true;
        chainList.push(chainId);
        emit ChainRegistered(chainId);
    }

    /// @notice Create a new proposal
    function createProposal(
        string memory _title,
        string memory _ipfsHash,
        uint256 _durationMinutes,
        address[] memory _targets,
        uint256[] memory _values,
        bytes[] memory _calldatas
    ) external {
        require(_durationMinutes > MIN_VOTING_DURATION, "Duration too short");
        require(
            _targets.length == _values.length &&
                _targets.length == _calldatas.length,
            "Mismatched execution data"
        );

        uint256 votingPower = governanceToken.getVotes(msg.sender);
        require(votingPower >= MIN_CREATION_POWER, "Insufficient voting power");

        proposalNonce++;
        bytes32 proposalId = keccak256(
            abi.encodePacked(msg.sender, block.number, proposalNonce)
        );

        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.title = _title;
        newProposal.ipfsHash = _ipfsHash;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + (_durationMinutes * 1 minutes);
        newProposal.proposer = msg.sender;
        newProposal.status = ProposalStatus.Pending;
        newProposal.targets = _targets;
        newProposal.values = _values;
        newProposal.calldatas = _calldatas;

        proposalIds.push(proposalId);
        emit ProposalCreated(proposalId, _title, newProposal.endTime);
    }

    /// @notice Cast vote for a proposal (Yes or No)
    function castVote(bytes32 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ProposalNotFound(proposalId);
        require(block.timestamp < proposal.endTime, "Voting period ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        uint256 votingPower = governanceToken.getPastVotes(
            msg.sender,
            proposal.startTime
        );
        require(votingPower > 0, "No voting power");

        if (support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }

        hasVoted[proposalId][msg.sender] = true;
        emit Voted(proposalId, msg.sender, support, votingPower);
    }

    /// @notice Called by relayer to submit secondary chain votes
    function collectSecondaryChainVotes(
        bytes32 proposalId,
        string memory chainId,
        uint256 yesVotes,
        uint256 noVotes
    ) external onlyRelayer {
        require(registeredChains[chainId], "Chain not registered");
        require(
            block.timestamp >= proposals[proposalId].endTime,
            "Voting period not ended"
        );
        require(
            !secondaryChainVotes[proposalId][chainId].collected,
            "Votes already collected"
        );

        secondaryChainVotes[proposalId][chainId] = VoteSummary({
            yesVotes: yesVotes,
            noVotes: noVotes,
            collected: true
        });

        emit SecondaryChainVotesCollected(
            proposalId,
            chainId,
            yesVotes,
            noVotes
        );
    }

    /// @notice Finalize a proposal by aggregating all chain votes and applying quorum
    function finalizeProposalVotes(bytes32 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ProposalNotFound(proposalId);
        if (block.timestamp < proposal.endTime)
            revert("Voting period not ended");
        if (proposal.voteTallyFinalized)
            revert ProposalAlreadyFinalized(proposalId);

        uint256 totalYesVotes = proposal.yesVotes;
        uint256 totalNoVotes = proposal.noVotes;

        for (uint i = 0; i < chainList.length; i++) {
            string memory chainId = chainList[i];
            if (!secondaryChainVotes[proposalId][chainId].collected) {
                revert VotesNotCollected(chainId);
            }

            VoteSummary storage summary = secondaryChainVotes[proposalId][
                chainId
            ];
            totalYesVotes += summary.yesVotes;
            totalNoVotes += summary.noVotes;
        }

        uint256 totalVotes = totalYesVotes + totalNoVotes;
        if (totalVotes < quorumVotes) {
            proposal.voteTallyFinalized = true;
            proposal.status = ProposalStatus.Rejected;
            emit VoteTallyFinalized(proposalId, totalYesVotes, totalNoVotes);
            return;
        }

        proposal.finalYesVotes = totalYesVotes;
        proposal.finalNoVotes = totalNoVotes;
        proposal.voteTallyFinalized = true;

        emit VoteTallyFinalized(proposalId, totalYesVotes, totalNoVotes);
    }

    /// @notice Execute an accepted proposal
    function executeProposal(bytes32 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.voteTallyFinalized) revert("Votes not finalized");
        if (proposal.executed) revert ProposalAlreadyExecuted(proposalId);

        if (proposal.finalYesVotes > proposal.finalNoVotes) {
            proposal.status = ProposalStatus.Accepted;

            for (uint i = 0; i < proposal.targets.length; i++) {
                (bool success, ) = proposal.targets[i].call{
                    value: proposal.values[i]
                }(proposal.calldatas[i]);
                if (!success) revert ExecutionFailed(proposal.targets[i], i);
            }

            proposal.executed = true;
            proposal.status = ProposalStatus.Executed;
        } else {
            proposal.status = ProposalStatus.Rejected;
        }

        emit ProposalExecuted(proposalId, proposal.status);
    }

    // ========================= VIEW FUNCTIONS ============================= //

    function getProposalIds() external view returns (bytes32[] memory) {
        return proposalIds;
    }

    function getProposalDetails(
        bytes32 proposalId
    ) external view returns (Proposal memory) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ProposalNotFound(proposalId);
        return proposal;
    }

    function hadUserVoted(
        bytes32 proposalId,
        address user
    ) external view returns (bool) {
        return hasVoted[proposalId][user];
    }

    function getUserVotingPowerAtProposal(
        bytes32 proposalId,
        address user
    ) external view returns (uint256) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.startTime == 0) revert ProposalNotFound(proposalId);
        return governanceToken.getPastVotes(user, proposal.startTime);
    }

    function getRegisteredChains() external view returns (string[] memory) {
        return chainList;
    }
}
