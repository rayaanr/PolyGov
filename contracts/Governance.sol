// SPDX-License-Identifier: MIT
// pragma solidity ^0.8.28;

// import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

// contract Governance is ReentrancyGuard, Ownable {
//     ERC20Votes public governanceToken;
//     address public relayer;

//     enum ProposalStatus {
//         Pending,
//         Accepted,
//         Rejected
//     }

//     struct Proposal {
//         bytes32 id; // UUID for uniqueness
//         string title;
//         string description;
//         uint256 yesVotes;
//         uint256 noVotes;
//         uint256 startTime;
//         uint256 endTime;
//         uint256 snapshotTimestamp; // Use timestamp instead of block number
//         uint256 snapshotBlock;
//         ProposalStatus status;
//         uint256 finalYesVotes;
//         uint256 finalNoVotes;
//         bool voteTallyFinalized;
//     }

//     mapping(bytes32 => Proposal) public proposals;
//     mapping(bytes32 => mapping(address => bool)) public hasVoted;
//     bytes32[] public proposalIds; // Store all proposal UUIDs for querying

//     error OnlyRelayer();
//     error ProposalAlreadyExists();
//     error VotingPeriodEnded();
//     error VotingPeriodNotEnded();
//     error AlreadyVoted();
//     error NoVotingPower();
//     error ExecutionFailed();
//     error VoteNotFinalized();
//     error VoteAlreadyFinalized();
//     error InvalidToken();

//     event ProposalCreated(
//         bytes32 indexed id,
//         string title,
//         string description,
//         uint256 startTime,
//         uint256 endTime,
//         uint256 snapshotTimestamp
//     );

//     event ProposalMirrored(
//         bytes32 indexed id,
//         string title,
//         string description,
//         uint256 startTime,
//         uint256 endTime,
//         uint256 snapshotTimestamp,
//         uint256 snapshotBlock
//     );

//     event VoteTallyFinalized(
//         bytes32 indexed id,
//         uint256 totalYesVotes,
//         uint256 totalNoVotes
//     );

//     event ProposalExecuted(bytes32 indexed id, ProposalStatus status);

//     event Voted(
//         bytes32 indexed proposalId,
//         address indexed voter,
//         bool support,
//         uint256 weight
//     );

//     event TokenUpdated(address indexed newToken);

//     struct GovernanceConfig {
//         address governanceToken;
//         address relayer;
//     }

//     constructor(GovernanceConfig memory config) Ownable(msg.sender) {
//         require(config.governanceToken != address(0), "Invalid token address");
//         require(config.relayer != address(0), "Invalid relayer address");

//         governanceToken = ERC20Votes(config.governanceToken);
//         relayer = config.relayer;
//     }

//     /** --------------------------------------
//      *  Admin: Update Governance Token Address
//      * -------------------------------------- */
//     function updateGovernanceToken(address _newToken) external onlyOwner {
//         require(_newToken != address(0), "Invalid token address");
//         governanceToken = ERC20Votes(_newToken);
//         emit TokenUpdated(_newToken);
//     }

//     /** --------------------------------------
//      *  Create Proposal with Unique UUID (Timestamp-Based Snapshot)
//      * -------------------------------------- */
//     function createProposal(
//         string memory _title,
//         string memory _description,
//         uint256 _durationHours
//     ) external nonReentrant {
//         require(_durationHours >= 1, "Duration too short");

//         uint256 votingPower = governanceToken.getVotes(msg.sender);
//         if (votingPower < 100 * 10 ** 18) {
//             revert NoVotingPower();
//         }

//         // Take a snapshot of the voting power timestamp
//         uint256 snapshotTimestamp = block.timestamp;

//         // Generate the unique proposal ID (UUID)
//         bytes32 proposalId = keccak256(
//             abi.encodePacked(
//                 block.timestamp,
//                 msg.sender,
//                 proposalIds.length,
//                 block.chainid
//             )
//         );

//         proposals[proposalId] = Proposal({
//             id: proposalId,
//             title: _title,
//             description: _description,
//             yesVotes: 0,
//             noVotes: 0,
//             startTime: block.timestamp,
//             endTime: block.timestamp + (_durationHours * 1 hours),
//             snapshotTimestamp: snapshotTimestamp,
//             snapshotBlock: block.number - 1, // Default to current chain block
//             status: ProposalStatus.Pending,
//             finalYesVotes: 0,
//             finalNoVotes: 0,
//             voteTallyFinalized: false
//         });

//         proposalIds.push(proposalId);

//         emit ProposalCreated(
//             proposalId,
//             _title,
//             _description,
//             block.timestamp,
//             block.timestamp + (_durationHours * 1 hours),
//             snapshotTimestamp
//         );
//     }

//     /** ----------------------------------------
//      *  Mirror Proposal (for relayer only)
//      * ---------------------------------------- */
//     function mirrorProposal(
//         bytes32 proposalId,
//         string memory _title,
//         string memory _description,
//         uint256 _startTime,
//         uint256 _endTime,
//         uint256 _snapshotTimestamp,
//         uint256 _snapshotBlock // Closest block found on this chain
//     ) external nonReentrant {
//         if (msg.sender != relayer) revert OnlyRelayer();
//         if (proposals[proposalId].startTime != 0)
//             revert ProposalAlreadyExists();

//         proposals[proposalId] = Proposal({
//             id: proposalId,
//             title: _title,
//             description: _description,
//             yesVotes: 0,
//             noVotes: 0,
//             startTime: _startTime,
//             endTime: _endTime,
//             snapshotTimestamp: _snapshotTimestamp,
//             snapshotBlock: _snapshotBlock, // Use closest block from relayer
//             status: ProposalStatus.Pending,
//             finalYesVotes: 0,
//             finalNoVotes: 0,
//             voteTallyFinalized: false
//         });

//         proposalIds.push(proposalId);

//         emit ProposalMirrored(
//             proposalId,
//             _title,
//             _description,
//             _startTime,
//             _endTime,
//             _snapshotTimestamp,
//             _snapshotBlock
//         );
//     }

//     /** ----------------------------------------
//      *  Voting Logic (Timestamp-Based Snapshot)
//      * ---------------------------------------- */
//     function vote(bytes32 proposalId, bool _support) external nonReentrant {
//         Proposal storage proposal = proposals[proposalId];

//         if (block.timestamp >= proposal.endTime) revert VotingPeriodEnded();
//         if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

//         // Use past voting power from snapshot
//         uint256 votingPower = governanceToken.getPastVotes(
//             msg.sender,
//             proposal.snapshotBlock
//         );
//         if (votingPower == 0) revert NoVotingPower();

//         if (_support) {
//             proposal.yesVotes += votingPower;
//         } else {
//             proposal.noVotes += votingPower;
//         }

//         hasVoted[proposalId][msg.sender] = true;

//         emit Voted(proposalId, msg.sender, _support, votingPower);
//     }

//     /** ----------------------------------------
//      *  Finalize Votes
//      * ---------------------------------------- */
//     function finalizeVoteTally(
//         bytes32 proposalId,
//         uint256 _totalYesVotes,
//         uint256 _totalNoVotes
//     ) external {
//         if (msg.sender != relayer) revert OnlyRelayer();

//         Proposal storage proposal = proposals[proposalId];

//         if (block.timestamp < proposal.endTime) revert VotingPeriodNotEnded();
//         if (proposal.voteTallyFinalized) revert VoteAlreadyFinalized();

//         proposal.finalYesVotes = _totalYesVotes;
//         proposal.finalNoVotes = _totalNoVotes;
//         proposal.voteTallyFinalized = true;

//         emit VoteTallyFinalized(proposalId, _totalYesVotes, _totalNoVotes);
//     }

//     /** ----------------------------------------
//      *  Execute Proposal
//      * ---------------------------------------- */
//     function executeProposal(bytes32 proposalId) external nonReentrant {
//         Proposal storage proposal = proposals[proposalId];

//         if (block.timestamp < proposal.endTime) revert VotingPeriodNotEnded();
//         if (!proposal.voteTallyFinalized) revert VoteNotFinalized();
//         if (proposal.status != ProposalStatus.Pending) revert ExecutionFailed();

//         proposal.status = (proposal.finalYesVotes > proposal.finalNoVotes)
//             ? ProposalStatus.Accepted
//             : ProposalStatus.Rejected;

//         emit ProposalExecuted(proposalId, proposal.status);
//     }

//     /** ----------------------------------------
//      *  Utility Functions
//      * ---------------------------------------- */
//     function getProposalCount() external view returns (uint256) {
//         return proposalIds.length;
//     }

//     function getAllProposalIds() external view returns (bytes32[] memory) {
//         return proposalIds;
//     }

//     function getVotingPower(address _voter) external view returns (uint256) {
//         return governanceToken.getVotes(_voter);
//     }
// }
