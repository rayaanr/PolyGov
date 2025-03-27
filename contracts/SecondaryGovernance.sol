// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// OpenZeppelin Contracts imports
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SecondaryGovernance
 * @author [Your Name or Project Name]
 * @notice Secondary chain contract for multi-chain governance. Mirrors proposals
 * from the main chain and allows local voting. Reports vote tallies back via a relayer.
 * @dev This contract works in conjunction with MainGovernance and a relayer service.
 * It uses ERC20Votes for snapshot voting based on timestamps provided by the main chain.
 * Proposal details are referenced via an IPFS CID mirrored from the main chain.
 */
contract SecondaryGovernance is Ownable, ReentrancyGuard {
    // --- State Variables ---

    ERC20Votes public immutable governanceToken; // Governance token instance on this chain
    address public relayer; // Trusted relayer address
    string public chainId; // Identifier for this secondary chain
    bool public constant isMainChain = false; // Deployment context flag

    // --- Proposal States (Mirrored from MainGovernance) ---
    enum ProposalStatus {
        Pending, // Proposal is active for voting
        Accepted, // Proposal was accepted on the main chain
        Rejected, // Proposal was rejected on the main chain
        Executed // Proposal was executed on the main chain (if applicable)
    }

    // --- Proposal Data (Mirrored) ---
    /** @dev Stores mirrored data associated with a governance proposal. */
    struct Proposal {
        bytes32 id; // Unique proposal identifier (from main chain)
        string title; // Short proposal title (mirrored)
        string ipfsCid; // IPFS CID for proposal details (mirrored)
        uint256 yesVotes; // Accumulated Yes votes on this chain
        uint256 noVotes; // Accumulated No votes on this chain
        uint256 startTime; // Voting start timestamp (mirrored from main chain)
        uint256 endTime; // Voting end timestamp (mirrored from main chain)
        ProposalStatus status; // Current proposal status (updated by relayer)
        bool voteTallied; // Indicates if local votes have been finalized for reporting
    }

    // --- Storage ---
    mapping(bytes32 => Proposal) public proposals; // proposalId => Proposal data
    mapping(bytes32 => mapping(address => bool)) public hasVoted; // proposalId => voter => voted?
    bytes32[] public proposalIds; // List of all mirrored proposal IDs

    // --- Events ---

    /** @dev Emitted when a proposal is mirrored from the main chain. */
    event ProposalMirrored(
        bytes32 indexed id,
        string title,
        string ipfsCid,
        uint256 endTime
    );
    /** @dev Emitted when the relayer address is updated. */
    event RelayerUpdated(address indexed newRelayer);
    /** @dev Emitted when a vote is cast on this chain. */
    event Voted(
        bytes32 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    /** @dev Emitted when local votes for a proposal are tallied and ready for collection. */
    event VotesTallied(
        bytes32 indexed proposalId,
        uint256 yesVotes,
        uint256 noVotes
    );
    /** @dev Emitted when the proposal's final status is updated by the relayer. */
    event ProposalStatusUpdated(
        bytes32 indexed proposalId,
        ProposalStatus status
    );

    // --- Modifiers ---

    /** @dev Restricts function access to the designated relayer address. */
    modifier onlyRelayer() {
        require(
            msg.sender == relayer,
            "SecondaryGov: Caller is not the relayer"
        );
        _;
    }

    /** @dev Validates that a proposal with the given ID exists (has been mirrored). */
    modifier validProposal(bytes32 proposalId) {
        require(
            proposals[proposalId].startTime > 0,
            "SecondaryGov: Proposal does not exist"
        );
        _;
    }

    // --- Constructor ---

    /**
     * @dev Sets up the secondary governance contract.
     * @param _token Address of the ERC20Votes governance token on this chain.
     * @param _relayer Address of the trusted relayer service.
     * @param _chainId Unique identifier string for this secondary chain.
     */
    constructor(
        address _token,
        address _relayer,
        string memory _chainId
    ) Ownable(msg.sender) {
        require(
            _token != address(0),
            "SecondaryGov: Invalid governance token address"
        );
        require(
            _relayer != address(0),
            "SecondaryGov: Invalid relayer address"
        );
        require(
            bytes(_chainId).length > 0,
            "SecondaryGov: Invalid chain identifier"
        );

        governanceToken = ERC20Votes(_token);
        relayer = _relayer;
        chainId = _chainId;
    }

    // --- Owner Functions ---

    /** @dev Updates the trusted relayer address. */
    function updateRelayer(address _newRelayer) external onlyOwner {
        require(
            _newRelayer != address(0),
            "SecondaryGov: Invalid new relayer address"
        );
        relayer = _newRelayer;
        emit RelayerUpdated(_newRelayer);
    }

    // --- Relayer Functions ---

    /**
     * @dev Mirrors proposal details from the main chain, initiated by the relayer.
     * Uses IPFS CID for detailed proposal content.
     * @param proposalId The unique ID from the main chain proposal.
     * @param _title The short title of the proposal.
     * @param _ipfsCid The IPFS CID containing detailed proposal metadata.
     * @param _startTime The voting start timestamp (from main chain).
     * @param _endTime The voting end timestamp (from main chain).
     */
    function mirrorProposal(
        bytes32 proposalId,
        string memory _title,
        string memory _ipfsCid, // Changed from _description
        uint256 _startTime,
        uint256 _endTime
    ) external onlyRelayer nonReentrant {
        // Added nonReentrant
        require(
            proposals[proposalId].startTime == 0,
            "SecondaryGov: Proposal already mirrored"
        );

        proposals[proposalId] = Proposal({
            id: proposalId,
            title: _title,
            ipfsCid: _ipfsCid, // Changed from description
            yesVotes: 0,
            noVotes: 0,
            startTime: _startTime,
            endTime: _endTime,
            status: ProposalStatus.Pending,
            voteTallied: false
        });

        proposalIds.push(proposalId);

        emit ProposalMirrored(proposalId, _title, _ipfsCid, _endTime); // Emit CID
    }

    /**
     * @dev Marks local voting as finished and emits the final tally for the relayer.
     * Can only be called by the relayer after the voting period ends.
     * @param proposalId The proposal ID to finalize locally.
     */
    function finalizeVotes(
        bytes32 proposalId
    ) external onlyRelayer nonReentrant validProposal(proposalId) {
        // Added nonReentrant
        Proposal storage proposal = proposals[proposalId];

        require(
            block.timestamp >= proposal.endTime,
            "SecondaryGov: Voting period has not ended"
        );
        require(
            !proposal.voteTallied,
            "SecondaryGov: Votes already tallied for this proposal"
        );

        proposal.voteTallied = true;
        // Note: Setting endTime here prevents future votes if called again, but primary check is voteTallied flag.
        // proposal.endTime = block.timestamp; // Optional: Update endTime to finalization time

        emit VotesTallied(proposalId, proposal.yesVotes, proposal.noVotes);
    }

    /**
     * @dev Updates the status of a mirrored proposal based on the final outcome on the main chain.
     * Only callable by the relayer.
     * @param proposalId The proposal ID.
     * @param _status The final status (Pending, Accepted, Rejected, Executed) from MainGovernance.
     */
    function updateProposalStatus(
        bytes32 proposalId,
        ProposalStatus _status // Accepts the updated enum including Executed
    ) external onlyRelayer validProposal(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        // Should typically only be called after local votes are tallied
        require(
            proposal.voteTallied,
            "SecondaryGov: Local votes must be tallied before updating status"
        );
        // Prevent reverting status from a final state? Optional.
        // require(proposal.status == ProposalStatus.Pending, "SecondaryGov: Status already finalized");

        proposal.status = _status;

        emit ProposalStatusUpdated(proposalId, _status);
    }

    // --- User Functions ---

    /**
     * @dev Casts a vote on an active mirrored proposal using snapshot voting power.
     * @param proposalId The proposal ID to vote on.
     * @param support Vote choice: true for Yes, false for No.
     */
    function castVote(
        bytes32 proposalId,
        bool support
    ) external nonReentrant validProposal(proposalId) {
        // Added nonReentrant
        Proposal storage proposal = proposals[proposalId];

        require(
            block.timestamp < proposal.endTime,
            "SecondaryGov: Voting period has ended"
        );
        require(
            proposal.status == ProposalStatus.Pending,
            "SecondaryGov: Proposal is not in voting phase"
        );
        require(
            !hasVoted[proposalId][msg.sender],
            "SecondaryGov: Voter has already voted"
        );

        // Use historical voting power based on main chain start time for consistency and security.
        uint256 votingPower = governanceToken.getPastVotes(
            msg.sender,
            proposal.startTime
        );
        require(
            votingPower > 0,
            "SecondaryGov: Voter had no voting power at proposal start"
        );

        if (support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }
        hasVoted[proposalId][msg.sender] = true;

        emit Voted(proposalId, msg.sender, support, votingPower);
    }

    // --- View Functions ---

    /** @dev Returns all mirrored proposal IDs. */
    function getProposalIds() external view returns (bytes32[] memory) {
        return proposalIds;
    }

    /** @dev Returns details of a specific mirrored proposal. */
    function getProposalDetails(
        bytes32 proposalId
    ) external view validProposal(proposalId) returns (Proposal memory) {
        return proposals[proposalId];
    }

    /** @dev Checks if a user has voted on a specific proposal on this chain. */
    function hasUserVoted(
        bytes32 proposalId,
        address user
    ) external view returns (bool) {
        // Renamed from hadUserVoted for consistency
        return hasVoted[proposalId][user];
    }

    /** @dev Returns the voting power a user had at the start time of a proposal. */
    function getUserVotingPowerAtProposal(
        bytes32 proposalId,
        address user
    ) external view validProposal(proposalId) returns (uint256) {
        // Ensures consistent snapshot view based on main chain start time
        return
            governanceToken.getPastVotes(user, proposals[proposalId].startTime);
    }

    /** @dev Returns the configured chain ID for this contract instance. */
    function getChainId() external view returns (string memory) {
        return chainId;
    }
}
