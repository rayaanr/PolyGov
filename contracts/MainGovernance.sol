// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MainGovernance is Ownable, ReentrancyGuard {
    ERC20Votes public governanceToken;
    address public relayer;
    bool public constant isMainChain = true;
    uint256 proposalNonce;

    // Governance config
    uint256 public requiredQuorumVotes;
    uint256 public minVotingDurationMinutes;
    uint256 public maxVotingDurationMinutes;

    enum ProposalStatus {
        Pending,
        Accepted,
        Rejected,
        Executed
    }

    struct Proposal {
        bytes32 id;
        address proposer;
        string title;
        string ipfsCid;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 startTime;
        uint256 endTime;
        ProposalStatus status;
        uint256 finalYesVotes;
        uint256 finalNoVotes;
        bool voteTallyFinalized;
        bool executed;
    }

    struct VoteSummary {
        uint256 yesVotes;
        uint256 noVotes;
        bool collected;
    }

    struct ProposalInput {
        string title;
        string ipfsCid;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        uint256 durationMinutes;
    }

    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    bytes32[] public proposalIds;
    mapping(string => bool) public registeredChains;
    string[] public chainList;
    mapping(bytes32 => mapping(string => VoteSummary))
        public secondaryChainVotes;

    event ProposalCreated(
        bytes32 indexed id,
        address indexed proposer,
        address[] targets,
        uint256[] values,
        bytes[] calldatas,
        uint256 startTime,
        uint256 endTime,
        string title,
        string ipfsCid
    );
    event RequiredQuorumUpdated(uint256 oldQuorumVotes, uint256 newQuorumVotes);
    event MinVotingDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event MaxVotingDurationUpdated(uint256 oldDuration, uint256 newDuration);
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
        uint256 totalNoVotes,
        bool quorumReached
    );
    event ProposalOutcomeDetermined(bytes32 indexed id, ProposalStatus status);
    event ProposalActionsExecuted(bytes32 indexed id);
    event SecondaryChainVotesCollected(
        bytes32 indexed proposalId,
        string chainId,
        uint256 yesVotes,
        uint256 noVotes
    );
    event ChainRegistered(string chainId);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "MainGov: Only relayer");
        _;
    }

    modifier validProposal(bytes32 proposalId) {
        require(
            proposals[proposalId].startTime > 0,
            "MainGov: Proposal doesn't exist"
        );
        _;
    }

    constructor(address _token, address _relayer) Ownable(msg.sender) {
        require(_token != address(0), "MainGov: Invalid token");
        require(_relayer != address(0), "MainGov: Invalid relayer");
        governanceToken = ERC20Votes(_token);
        relayer = _relayer;
        requiredQuorumVotes = 1000 * 10 ** 18;
        minVotingDurationMinutes = 4;
        maxVotingDurationMinutes = 15;
        emit RequiredQuorumUpdated(0, requiredQuorumVotes);
        emit MinVotingDurationUpdated(0, minVotingDurationMinutes);
        emit MaxVotingDurationUpdated(0, maxVotingDurationMinutes);
    }

    function setRequiredQuorum(uint256 _newQuorumVotes) external onlyOwner {
        uint256 oldQuorum = requiredQuorumVotes;
        requiredQuorumVotes = _newQuorumVotes;
        emit RequiredQuorumUpdated(oldQuorum, _newQuorumVotes);
    }

    function setMinVotingDuration(uint256 _minutes) external onlyOwner {
        require(_minutes <= maxVotingDurationMinutes, "MainGov: Min > Max");
        emit MinVotingDurationUpdated(minVotingDurationMinutes, _minutes);
        minVotingDurationMinutes = _minutes;
    }

    function setMaxVotingDuration(uint256 _minutes) external onlyOwner {
        require(_minutes >= minVotingDurationMinutes, "MainGov: Max < Min");
        emit MaxVotingDurationUpdated(maxVotingDurationMinutes, _minutes);
        maxVotingDurationMinutes = _minutes;
    }

    function updateRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "MainGov: Invalid relayer");
        relayer = _newRelayer;
        emit RelayerUpdated(_newRelayer);
    }

    function addSecondaryChain(string memory chainId) external onlyOwner {
        require(!registeredChains[chainId], "MainGov: Chain registered");
        registeredChains[chainId] = true;
        chainList.push(chainId);
        emit ChainRegistered(chainId);
    }

    function createProposal(
        ProposalInput memory input
    ) external returns (bytes32 proposalId) {
        require(bytes(input.ipfsCid).length > 0, "MainGov: IPFS CID required");
        require(
            input.targets.length == input.values.length &&
                input.targets.length == input.calldatas.length,
            "MainGov: Input mismatch"
        );
        require(input.targets.length > 0, "MainGov: No targets");
        require(
            input.durationMinutes >= minVotingDurationMinutes,
            "MainGov: Too short"
        );
        require(
            input.durationMinutes <= maxVotingDurationMinutes,
            "MainGov: Too long"
        );

        uint256 votingPower = governanceToken.getVotes(msg.sender);
        require(votingPower > 0, "MainGov: No voting power");

        proposalNonce++;
        proposalId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                proposalNonce,
                input.title,
                input.ipfsCid
            )
        );

        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.proposer = msg.sender;
        p.title = input.title;
        p.ipfsCid = input.ipfsCid;
        p.targets = input.targets;
        p.values = input.values;
        p.calldatas = input.calldatas;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + input.durationMinutes * 1 minutes;
        p.status = ProposalStatus.Pending;
        proposalIds.push(proposalId);

        emit ProposalCreated(
            proposalId,
            msg.sender,
            input.targets,
            input.values,
            input.calldatas,
            p.startTime,
            p.endTime,
            input.title,
            input.ipfsCid
        );
    }

    function castVote(
        bytes32 proposalId,
        bool support
    ) external nonReentrant validProposal(proposalId) {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.endTime, "MainGov: Voting ended");
        require(p.status == ProposalStatus.Pending, "MainGov: Not pending");
        require(!hasVoted[proposalId][msg.sender], "MainGov: Already voted");
        uint256 votes = governanceToken.getPastVotes(msg.sender, p.startTime);
        require(votes > 0, "MainGov: No past votes");
        if (support) p.yesVotes += votes;
        else p.noVotes += votes;
        hasVoted[proposalId][msg.sender] = true;
        emit Voted(proposalId, msg.sender, support, votes);
    }

    function collectSecondaryChainVotes(
        bytes32 proposalId,
        string memory chainId,
        uint256 yesVotes,
        uint256 noVotes
    ) external onlyRelayer nonReentrant validProposal(proposalId) {
        require(registeredChains[chainId], "MainGov: Chain not registered");
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.endTime, "MainGov: Voting not ended");
        require(!p.voteTallyFinalized, "MainGov: Tally done");
        require(
            !secondaryChainVotes[proposalId][chainId].collected,
            "MainGov: Already collected"
        );
        secondaryChainVotes[proposalId][chainId] = VoteSummary(
            yesVotes,
            noVotes,
            true
        );
        emit SecondaryChainVotesCollected(
            proposalId,
            chainId,
            yesVotes,
            noVotes
        );
    }

    function finalizeProposalVotes(
        bytes32 proposalId
    ) external nonReentrant validProposal(proposalId) {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.endTime + 1 minutes, "MainGov: Cooldown");
        require(p.status == ProposalStatus.Pending, "MainGov: Not pending");
        require(!p.voteTallyFinalized, "MainGov: Already finalized");

        uint256 yes = p.yesVotes;
        uint256 no = p.noVotes;
        for (uint256 i = 0; i < chainList.length; i++) {
            VoteSummary memory s = secondaryChainVotes[proposalId][
                chainList[i]
            ];
            if (s.collected) {
                yes += s.yesVotes;
                no += s.noVotes;
            }
        }

        p.finalYesVotes = yes;
        p.finalNoVotes = no;
        p.voteTallyFinalized = true;

        bool quorumReached = (yes + no) >= requiredQuorumVotes;
        emit VoteTallyFinalized(proposalId, yes, no, quorumReached);

        if (quorumReached && yes > no) {
            p.status = ProposalStatus.Accepted;
            emit ProposalOutcomeDetermined(proposalId, p.status);
            _executeProposalActions(proposalId);
            p.status = ProposalStatus.Executed;
            p.executed = true;
            emit ProposalActionsExecuted(proposalId);
        } else {
            p.status = ProposalStatus.Rejected;
            emit ProposalOutcomeDetermined(proposalId, p.status);
        }
    }

    function _executeProposalActions(bytes32 proposalId) internal {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Accepted, "MainGov: Not Accepted");
        require(!p.executed, "MainGov: Already executed");
        for (uint256 i = 0; i < p.targets.length; i++) {
            (bool success, ) = p.targets[i].call{value: p.values[i]}(
                p.calldatas[i]
            );
            require(success, "MainGov: Exec failed");
        }
    }

    function getProposalDetails(
        bytes32 proposalId
    ) external view validProposal(proposalId) returns (Proposal memory) {
        return proposals[proposalId];
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
    ) external view validProposal(proposalId) returns (uint256) {
        return
            governanceToken.getPastVotes(user, proposals[proposalId].startTime);
    }

    function getProposalIds() external view returns (bytes32[] memory) {
        return proposalIds;
    }

    function getRegisteredChains() external view returns (string[] memory) {
        return chainList;
    }

    function state(
        bytes32 proposalId
    ) external view validProposal(proposalId) returns (ProposalStatus) {
        return proposals[proposalId].status;
    }
}
