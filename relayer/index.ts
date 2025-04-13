// import { Wallet, Contract } from "ethers";
// import dotenv from "dotenv";
// import fs from "fs";
// import WebSocket from "ws";
// import { createWebSocketProvider, setupWebSocketHealthCheck } from "./utils/ws";
// import { loadProposalCache, markProposalAsFinalized, saveProposalCache } from "./utils/cache";
// import { CACHE_FILE_PATH, CONFIG, MAIN_GOVERNANCE_ABI, SECONDARY_GOVERNANCE_ABI } from "./config";
// import { reconnectMainChain, reconnectSecondaryChain } from "./utils/reconnect";
// import { type ContractConnections, type EthersError, type ProposalCache } from "./types";
// import { decodeCustomError } from "./utils/decodeCustomError";
// import { sendTransactionWithManagedNonce } from "./utils/transaction";

// dotenv.config();

// async function initializeContracts(): Promise<{
//     main: ContractConnections;
//     secondary: Record<string, ContractConnections>;
// }> {
//     if (!process.env.RELAYER_PVT_KEY) {
//         throw new Error("RELAYER_PVT_KEY is not set in environment variables");
//     }

//     const mainProvider = createWebSocketProvider(CONFIG.MAIN.WS_URL);
//     const mainSigner = new Wallet(process.env.RELAYER_PVT_KEY, mainProvider);
//     const mainContract = new Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

//     const secondaryConnections: Record<string, ContractConnections> = {};

//     for (const chain of CONFIG.SECONDARY_CHAINS) {
//         try {
//             const provider = createWebSocketProvider(chain.WS_URL);
//             const signer = new Wallet(process.env.RELAYER_PVT_KEY, provider);
//             const contract = new Contract(chain.CONTRACT, SECONDARY_GOVERNANCE_ABI, signer);

//             secondaryConnections[chain.CHAIN_ID] = {
//                 provider,
//                 contract,
//                 signer,
//                 wsInstance: provider.websocket as WebSocket,
//             };
//             console.log(`🔌 Connected to ${chain.CHAIN_ID} chain`);
//         } catch (error) {
//             console.error(`❌ Failed to connect to ${chain.CHAIN_ID} chain:`, error);
//         }
//     }

//     return {
//         main: {
//             provider: mainProvider,
//             contract: mainContract,
//             signer: mainSigner,
//             wsInstance: mainProvider.websocket as WebSocket,
//         },
//         secondary: secondaryConnections,
//     };
// }

// export function setupMainChainEventListeners(
//     mainContract: Contract,
//     secondaryConnections: Record<string, ContractConnections>
// ) {
//     console.log("🎧 Setting up event listeners for main chain");

//     mainContract.on("ProposalCreated", async (id, title, endTime, event) => {
//         console.log(`🆕 New proposal created on main chain: ${id} - ${title}`);
//         try {
//             const proposal = await mainContract.getProposalDetails(id);
//             for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
//                 try {
//                     console.log(`🔄 Mirroring proposal ${id} to ${chainId}`);
//                     try {
//                         const secondaryProposal = await contract.getProposalDetails(id);
//                         if (secondaryProposal.startTime > 0) {
//                             console.log(`ℹ️ Proposal ${id} already exists on ${chainId}`);
//                             continue;
//                         }
//                     } catch (err) {}
//                     const tx = await contract.mirrorProposal(
//                         id,
//                         proposal.title,
//                         proposal.ipfsHash,
//                         proposal.startTime,
//                         proposal.endTime,
//                         proposal.proposer
//                     );
//                     await tx.wait();
//                     console.log(`✅ Proposal ${id} mirrored to ${chainId}`);
//                 } catch (error) {
//                     console.error(`❌ Error mirroring proposal to ${chainId}:`, error);
//                 }
//             }
//         } catch (error) {
//             console.error(`❌ Error processing proposal created event:`, error);
//         }
//     });

//     mainContract.on("ProposalExecuted", async (id, mainStatus /* BigInt or number */, event) => {
//         console.log(`🚀 Proposal ${id} executed on main chain with status: ${mainStatus}`);

//         // Map MainChain status to SecondaryChain status
//         // Assuming: Main: 0=Pending, 1=Accepted, 2=Rejected, 3=Executed
//         // Assuming: Secondary: 0=Pending, 1=Accepted, 2=Rejected
//         let secondaryStatus: number;
//         const mainStatusNum = Number(mainStatus); // Convert BigInt if necessary

//         if (mainStatusNum === 1 || mainStatusNum === 3) {
//             // Accepted or Executed on Main maps to Accepted on Secondary
//             secondaryStatus = 1;
//         } else if (mainStatusNum === 2) {
//             // Rejected on Main maps to Rejected on Secondary
//             secondaryStatus = 2;
//         } else {
//             console.log(
//                 `ℹ️ Skipping status update for proposal ${id} due to main status: ${mainStatusNum}`
//             );
//             return; // Or map Pending to Pending (0) if desired
//         }

//         for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
//             try {
//                 // Check current secondary status if needed before updating
//                 // const secondaryProposal = await contract.getProposalDetails(id);
//                 // if (secondaryProposal.status === secondaryStatus) continue;

//                 console.log(
//                     `🔄 Updating proposal ${id} status to ${secondaryStatus} on ${chainId}`
//                 );
//                 const tx = await contract.updateProposalStatus(id, secondaryStatus);
//                 await tx.wait();
//                 console.log(`✅ Updated proposal ${id} status to ${secondaryStatus} on ${chainId}`);
//             } catch (error) {
//                 console.log(`⚠️ Error updating proposal ${id} status on ${chainId}:`, error);
//                 const err = error as EthersError;
//                 const rawData = err?.error?.data || err?.data;
//                 const decodedError = rawData
//                     ? decodeCustomError(rawData, SECONDARY_GOVERNANCE_ABI)
//                     : null;

//                 if (decodedError) {
//                     console.error(`❌ Custom Error updating status: ${decodedError}`);
//                 } else {
//                     console.error(`❌ Error updating status (unknown):`, error);
//                 }
//             }
//         }
//     });
// }

// async function verifyVoteCollectionStatus(
//     mainContract: Contract,
//     chainId: string,
//     proposalId: string
// ): Promise<boolean> {
//     try {
//         const secondaryVotes = await mainContract.getSecondaryChainVotes(proposalId, chainId);
//         if (secondaryVotes.collected) {
//             console.log(`ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`);
//             return true;
//         }
//     } catch (err: any) {
//         if (err.reason?.toLowerCase().includes("votes already collected")) {
//             console.log(`ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`);
//             return true;
//         }
//     }

//     try {
//         console.log(`✅ Collected votes from ${chainId} for proposal ${proposalId}`);
//         return true;
//     } catch (err: any) {
//         if (err.reason?.toLowerCase().includes("votes already collected")) {
//             console.log(`ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`);
//             return true;
//         }
//         throw err;
//     }
// }

// async function finalizeVotes(
//     mainContract: Contract,
//     proposalId: string,
//     endTime: number,
//     cache: ProposalCache
// ): Promise<void> {
//     const currentTime = Math.floor(Date.now() / 1000);

//     if (currentTime < endTime) {
//         console.log(`⏩ Voting still ongoing for proposal ${proposalId}`);
//         return;
//     }

//     try {
//         const proposal = await mainContract.getProposalDetails(proposalId);

//         if (proposal.voteTallyFinalized === true || proposal.voteTallyFinalized === "true") {
//             console.log(`⏩ Proposal ${proposalId} already finalized`);
//             markProposalAsFinalized(proposalId.toString(), cache);
//             return;
//         }

//         const registeredChains = await mainContract.getRegisteredChains();
//         for (const chainId of registeredChains) {
//             const votes = await mainContract.getSecondaryChainVotes(proposalId, chainId);
//             if (!votes.collected) {
//                 console.log(`⏩ Skipping finalization: votes from ${chainId} not collected yet`);
//                 return;
//             }
//         }

//         try {
//             const finalizeTx = await mainContract.finalizeProposalVotes(proposalId);
//             await finalizeTx.wait();
//             console.log(`✅ Finalized vote tally for proposal ${proposalId}`);
//             markProposalAsFinalized(proposalId.toString(), cache);
//         } catch (err: any) {
//             const msg = err?.reason || err?.error?.message || "";
//             if (
//                 msg.toLowerCase().includes("already finalized") ||
//                 err?.error?.data?.includes("already finalized")
//             ) {
//                 console.log(`⚠️ Proposal ${proposalId} already finalized (fallback catch)`);
//                 markProposalAsFinalized(proposalId.toString(), cache);
//                 return;
//             }
//             console.error(`❌ Error finalizing proposal ${proposalId}:`, err);
//         }
//     } catch (error) {
//         console.error(`❌ Error finalizing proposal ${proposalId}:`, error);
//     }
// }

// async function mirrorProposal(
//     contract: Contract,
//     proposalId: string,
//     proposal: any,
//     chainId: string,
//     isExpired: boolean
// ): Promise<void> {
//     try {
//         const tx = await contract.mirrorProposal(
//             proposalId,
//             proposal.title,
//             proposal.ipfsHash,
//             proposal.startTime,
//             proposal.endTime,
//             proposal.proposer
//         );
//         await tx.wait();
//         console.log(`✅ Proposal ${proposalId} mirrored to ${chainId}`);

//         if (isExpired) {
//             const finalizeTx = await sendTransactionWithManagedNonce(contract, "finalizeVotes", [
//                 proposalId,
//             ]);
//             // await finalizeTx.wait();
//             console.log(
//                 `✅ Votes finalized for newly mirrored expired proposal ${proposalId} on ${chainId} in ${finalizeTx.hash}`
//             );
//         }
//     } catch (error) {
//         console.error(`❌ Error mirroring/finalizing proposal ${proposalId} on ${chainId}:`, error);
//     }
// }

// function setupSecondaryChainEventListeners(
//     mainContract: Contract,
//     secondaryConnections: Record<string, ContractConnections>
// ) {
//     console.log("🎧 Setting up event listeners for secondary chains");

//     for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
//         contract.on("VotesTallied", async (proposalId, yesVotes, noVotes, event) => {
//             console.log(
//                 `🗳️ Votes tallied for proposal ${proposalId} on ${chainId}: Yes=${yesVotes}, No=${noVotes}`
//             );
//             try {
//                 const votesCollected = await verifyVoteCollectionStatus(
//                     mainContract,
//                     chainId,
//                     proposalId
//                 );

//                 if (votesCollected) {
//                     const proposal = await mainContract.getProposalDetails(proposalId);

//                     if (!proposal.voteTallyFinalized) {
//                         await finalizeVotes(
//                             mainContract,
//                             proposalId,
//                             Number(proposal.endTime),
//                             loadProposalCache()
//                         );
//                     }
//                 }
//             } catch (error) {
//                 console.error(`❌ Error processing votes for ${proposalId} on ${chainId}:`, error);
//             }
//         });
//     }
// }

// async function syncExistingProposals(
//     mainContract: Contract,
//     secondaryConnections: Record<string, ContractConnections>
// ) {
//     console.log("🔄 Syncing existing proposals from main chain to secondary chains");
//     const cache = loadProposalCache();
//     const finalizedIds = new Set(cache.finalized.map((p) => p.id));

//     try {
//         const proposalIds = await mainContract.getProposalIds();
//         console.log(`📄 Found ${proposalIds.length} proposals on main chain`);
//         const currentTime = Math.floor(Date.now() / 1000);

//         for (const proposalId of proposalIds) {
//             // Skip if proposal is already finalized
//             if (finalizedIds.has(proposalId.toString())) {
//                 console.log(`⏩ Skipping finalized proposal ${proposalId}`);
//                 continue;
//             }

//             try {
//                 const mainProposal = await mainContract.getProposalDetails(proposalId);
//                 // Mark as finalized if it's already finalized on-chain
//                 if (mainProposal.voteTallyFinalized) {
//                     markProposalAsFinalized(proposalId.toString(), cache);
//                     console.log(`⏩ Skipping newly detected finalized proposal ${proposalId}`);
//                     continue;
//                 }

//                 console.log(
//                     `🔍 Processing proposal ${proposalId} - End Time: ${mainProposal.endTime}, Current Time: ${currentTime}`
//                 );
//                 const isExpired = Number(mainProposal.endTime) <= currentTime;

//                 for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
//                     try {
//                         let secondaryProposal;
//                         let proposalExists = true;
//                         console.log(`🔎 Checking proposal ${proposalId} on ${chainId}`);
//                         try {
//                             secondaryProposal = await contract.getProposalDetails(proposalId);
//                             console.log(
//                                 `ℹ️ Proposal ${proposalId} found on ${chainId}, voteTallied: ${secondaryProposal.voteFinalized}`
//                             );
//                         } catch (err) {
//                             console.log(`⚠️ Proposal ${proposalId} not found on ${chainId}`);
//                             proposalExists = false;
//                         }

//                         if (!proposalExists || secondaryProposal.startTime === 0n) {
//                             console.log(
//                                 `🔄 Mirroring missing proposal ${proposalId} to ${chainId}`
//                             );
//                             await mirrorProposal(
//                                 contract,
//                                 proposalId,
//                                 mainProposal,
//                                 chainId,
//                                 isExpired
//                             );
//                         } else if (isExpired && !secondaryProposal.voteFinalized) {
//                             console.log(
//                                 `⏳ Proposal ${proposalId} exists but not finalized on ${chainId}, finalizing`
//                             );
//                             try {
//                                 const finalizeTx = await sendTransactionWithManagedNonce(
//                                     contract,
//                                     "finalizeVotes",
//                                     [proposalId]
//                                 );
//                                 // await finalizeTx.wait();
//                                 console.log(
//                                     `✅ Proposal ${proposalId} votes finalized on ${chainId} in ${finalizeTx.hash}`
//                                 );
//                             } catch (error) {
//                                 console.error(
//                                     `❌ Failed to finalize existing proposal ${proposalId} on ${chainId}:`,
//                                     error
//                                 );
//                             }
//                         } else if (
//                             mainProposal.status !== secondaryProposal.status &&
//                             mainProposal.status !== 0
//                         ) {
//                             console.log(
//                                 `🔄 Updating status for proposal ${proposalId} on ${chainId}`
//                             );
//                             const tx = await contract.updateProposalStatus(
//                                 proposalId,
//                                 mainProposal.status
//                             );
//                             await tx.wait();
//                             console.log(`✅ Updated proposal ${proposalId} status on ${chainId}`);
//                         } else {
//                             console.log(
//                                 `✅ Proposal ${proposalId} already synced and up-to-date on ${chainId}`
//                             );
//                         }
//                     } catch (error) {
//                         console.error(
//                             `❌ Error processing proposal ${proposalId} for ${chainId}:`,
//                             error
//                         );
//                     }
//                 }
//             } catch (error) {
//                 console.error(`❌ Error processing proposal ${proposalId}:`, error);
//             }
//         }
//     } catch (error) {
//         console.error("❌ Error syncing existing proposals:", error);
//     }
// }

// async function processEndedProposals(
//     mainContract: Contract,
//     secondaryConnections: Record<string, ContractConnections>
// ) {
//     console.log("🔄 Processing proposals with ended voting periods");
//     const cache = loadProposalCache();

//     try {
//         const proposalIds = await mainContract.getProposalIds();
//         const currentTime = Math.floor(Date.now() / 1000);
//         const finalizedIds = new Set(cache.finalized.map((p) => p.id));

//         for (const proposalId of proposalIds) {
//             // Skip if proposal is already finalized
//             if (finalizedIds.has(proposalId.toString())) {
//                 continue;
//             }

//             try {
//                 const mainProposal = await mainContract.getProposalDetails(proposalId);

//                 if (Number(mainProposal.endTime) > currentTime || mainProposal.voteTallyFinalized) {
//                     if (mainProposal.voteTallyFinalized) {
//                         markProposalAsFinalized(proposalId.toString(), cache);
//                     }
//                     continue;
//                 }

//                 const registeredChains = await mainContract.getRegisteredChains();

//                 for (const chainId of registeredChains) {
//                     if (!secondaryConnections[chainId]) continue;

//                     try {
//                         const { contract } = secondaryConnections[chainId];
//                         let secondaryProposal;
//                         let proposalExists = true;

//                         try {
//                             secondaryProposal = await contract.getProposalDetails(proposalId);
//                             console.log(
//                                 `ℹ️ Proposal ${proposalId} on ${chainId} - VoteTallied: ${secondaryProposal.voteFinalized}`
//                             );
//                         } catch (err) {
//                             console.log(`⚠️ Proposal ${proposalId} not found on ${chainId}`);
//                             proposalExists = false;
//                         }

//                         if (!proposalExists || secondaryProposal.startTime === 0n) {
//                             console.log(
//                                 `⚠️ Proposal ${proposalId} missing on ${chainId}, mirroring`
//                             );
//                             await mirrorProposal(contract, proposalId, mainProposal, chainId, true);
//                             secondaryProposal = await contract.getProposalDetails(proposalId);
//                         }

//                         // Check if votes are already collected before proceeding
//                         let votesCollected = false;
//                         try {
//                             const secondaryVotes = await mainContract.getSecondaryChainVotes(
//                                 proposalId,
//                                 chainId
//                             );
//                             votesCollected = secondaryVotes.collected;
//                             console.log(
//                                 `ℹ️ Votes collected status for ${proposalId} on ${chainId}: ${votesCollected}`
//                             );
//                             if (votesCollected) {
//                                 console.log(
//                                     `⏩ Skipping vote collection for ${proposalId} on ${chainId} - votes already collected`
//                                 );
//                                 continue;
//                             }
//                         } catch (err) {
//                             console.log(
//                                 `⚠️ Could not check vote collection status for ${proposalId} on ${chainId}, proceeding`
//                             );
//                         }

//                         if (
//                             !secondaryProposal.voteFinalized &&
//                             Number(secondaryProposal.endTime) <= currentTime
//                         ) {
//                             console.log(`🗳️ Finalizing votes for ${proposalId} on ${chainId}`);
//                             const finalizeTx = await contract.finalizeVotes(proposalId);
//                             await finalizeTx.wait();
//                             console.log(`✅ Votes finalized for ${proposalId} on ${chainId}`);
//                             secondaryProposal = await contract.getProposalDetails(proposalId);
//                         }

//                         if (secondaryProposal.voteFinalized && !votesCollected) {
//                             console.log(`📊 Collecting votes for ${proposalId} from ${chainId}`);
//                             try {
//                                 const collectTx = await mainContract.collectSecondaryChainVotes(
//                                     proposalId,
//                                     chainId,
//                                     secondaryProposal.yesVotes,
//                                     secondaryProposal.noVotes
//                                 );
//                                 await collectTx.wait();
//                                 console.log(
//                                     `✅ Collected votes from ${chainId} for proposal ${proposalId}`
//                                 );
//                             } catch (err: any) {
//                                 if (err.reason?.toLowerCase().includes("votes already collected")) {
//                                     console.log(
//                                         `ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`
//                                     );
//                                     continue;
//                                 }
//                                 throw err;
//                             }
//                         } else if (votesCollected) {
//                             console.log(
//                                 `⏩ Votes already collected for ${proposalId} on ${chainId}, skipping`
//                             );
//                         } else {
//                             console.log(
//                                 `⚠️ Votes not tallied for ${proposalId} on ${chainId}, cannot collect`
//                             );
//                         }
//                     } catch (error) {
//                         console.error(
//                             `❌ Error processing votes from ${chainId} for ${proposalId}:`,
//                             error
//                         );
//                         const err = error as EthersError;
//                         const rawData = err?.error?.data || err?.data;
//                         const decodedError = rawData
//                             ? decodeCustomError(rawData, SECONDARY_GOVERNANCE_ABI)
//                             : null;
//                         if (decodedError) {
//                             console.error(`❌ Custom Error: ${decodedError}`);
//                         } else {
//                             console.error(`❌ Error (unknown):`, error);
//                         }
//                     }
//                 }

//                 await finalizeVotes(mainContract, proposalId, Number(mainProposal.endTime), cache);
//             } catch (error) {
//                 console.error(`❌ Error processing proposal ${proposalId}:`, error);
//             }
//         }
//     } catch (error) {
//         console.error("❌ Error processing ended proposals:", error);
//     }
// }

// function scheduleRecurringTasks(
//     mainContract: Contract,
//     secondaryConnections: Record<string, ContractConnections>
// ) {
//     setInterval(async () => {
//         await processEndedProposals(mainContract, secondaryConnections);
//     }, 2 * 60 * 1000);

//     setInterval(async () => {
//         await syncExistingProposals(mainContract, secondaryConnections);
//     }, 60 * 60 * 1000);
// }

// async function main() {
//     console.log("🔗 Starting Multi-Chain Governance Relayer with WebSockets");
//     try {
//         // Initialize cache if it doesn't exist
//         if (!fs.existsSync(CACHE_FILE_PATH)) {
//             saveProposalCache({ finalized: [], lastUpdate: Math.floor(Date.now() / 1000) });
//         }

//         const connections = await initializeContracts();
//         setupWebSocketHealthCheck(connections, {
//             reconnectMain: async () => reconnectMainChain(connections),
//             reconnectSecondary: async (chainId: string) =>
//                 reconnectSecondaryChain(connections, chainId),
//         });
//         setupMainChainEventListeners(connections.main.contract, connections.secondary);
//         setupSecondaryChainEventListeners(connections.main.contract, connections.secondary);
//         await syncExistingProposals(connections.main.contract, connections.secondary);
//         await processEndedProposals(connections.main.contract, connections.secondary);
//         scheduleRecurringTasks(connections.main.contract, connections.secondary);
//         console.log("✅ Relayer initialized and running");
//     } catch (error) {
//         console.error("❌ Error initializing relayer:", error);
//         process.exit(1);
//     }
// }

// process.on("SIGINT", async () => {
//     console.log("👋 Gracefully shutting down...");
//     process.exit(0);
// });

// main().catch((error) => {
//     console.error("❌ Fatal error:", error);
//     process.exit(1);
// });
