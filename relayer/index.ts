// import { ethers } from "ethers";
// import dotenv from "dotenv";
// import fs from "fs";
// import path from "path";
// import WebSocket from "ws";

// dotenv.config();

// interface ContractConnections {
//     provider: ethers.WebSocketProvider;
//     contract: ethers.Contract;
//     signer: ethers.Wallet;
//     wsInstance?: WebSocket;
// }

// interface FinalizedProposal {
//     id: string;
//     timestamp: number;
// }

// interface ProposalCache {
//     finalized: FinalizedProposal[];
//     lastUpdate: number;
// }

// const CONFIG = {
//     MAIN: {
//         CHAIN_ID: "main",
//         RPC_URL: process.env.BSC_RPC || "",
//         WS_URL: process.env.BSC_WS_URL || "",
//         CONTRACT: "0x4F90cb1474bF846682B267e62cEA52505477B378",
//     },
//     SECONDARY_CHAINS: [
//         {
//             CHAIN_ID: "arb",
//             RPC_URL: process.env.ARB_RPC || "",
//             WS_URL: process.env.ARB_WS_URL || "",
//             CONTRACT: "0x82ACdE34e54B408E808a8f625648ED4eCe7A745e",
//         },
//     ],
// };

// const MAIN_GOVERNANCE_ABI = JSON.parse(
//     fs.readFileSync(path.join(__dirname, "../abi/main.json"), "utf8")
// );

// const SECONDARY_GOVERNANCE_ABI = JSON.parse(
//     fs.readFileSync(path.join(__dirname, "../abi/secondary.json"), "utf8")
// );

// const CACHE_FILE_PATH = path.join(__dirname, "proposal_cache.json");

// function createWebSocketProvider(wsUrl: string): ethers.WebSocketProvider {
//     const ws = new WebSocket(wsUrl, {
//         perMessageDeflate: false,
//         timeout: 30000,
//     });

//     const provider = new ethers.WebSocketProvider(ws as any, undefined, {
//         pollingInterval: 1000,
//     });

//     ws.on("error", (error) => {
//         console.error(`WebSocket error for ${wsUrl}:`, error);
//     });

//     ws.on("close", () => {
//         console.log(`WebSocket closed for ${wsUrl}, will attempt to reconnect...`);
//     });

//     return provider;
// }

// async function initializeContracts(): Promise<{
//     main: ContractConnections;
//     secondary: Record<string, ContractConnections>;
// }> {
//     if (!process.env.RELAYER_PVT_KEY) {
//         throw new Error("RELAYER_PVT_KEY is not set in environment variables");
//     }

//     const mainProvider = createWebSocketProvider(CONFIG.MAIN.WS_URL);
//     const mainSigner = new ethers.Wallet(process.env.RELAYER_PVT_KEY, mainProvider);
//     const mainContract = new ethers.Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

//     const secondaryConnections: Record<string, ContractConnections> = {};

//     for (const chain of CONFIG.SECONDARY_CHAINS) {
//         try {
//             const provider = createWebSocketProvider(chain.WS_URL);
//             const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY, provider);
//             const contract = new ethers.Contract(chain.CONTRACT, SECONDARY_GOVERNANCE_ABI, signer);

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

// function setupMainChainEventListeners(
//     mainContract: ethers.Contract,
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
//                         proposal.description,
//                         proposal.startTime,
//                         proposal.endTime
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

//     mainContract.on("ProposalExecuted", async (id, status, event) => {
//         console.log(`🚀 Proposal ${id} executed on main chain with status: ${status}`);
//         for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
//             try {
//                 const tx = await contract.updateProposalStatus(id, status);
//                 await tx.wait();
//                 console.log(`✅ Updated proposal ${id} status to ${status} on ${chainId}`);
//             } catch (error) {
//                 console.error(`❌ Error updating proposal status on ${chainId}:`, error);
//             }
//         }
//     });
// }

// async function checkAndCollectVotes(
//     mainContract: ethers.Contract,
//     chainId: string,
//     proposalId: string,
//     yesVotes: bigint,
//     noVotes: bigint
// ): Promise<boolean> {
//     try {
//         const secondaryVotes = await mainContract.secondaryChainVotes(proposalId, chainId);
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
//         const tx = await mainContract.collectSecondaryChainVotes(
//             proposalId,
//             chainId,
//             yesVotes,
//             noVotes
//         );
//         await tx.wait();
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

// async function finalizeVotesIfPossible(
//     mainContract: ethers.Contract,
//     proposalId: string,
//     endTime: number,
//     cache: ProposalCache
// ): Promise<void> {
//     const currentTime = Math.floor(Date.now() / 1000);
//     const cooldownEndTime = Number(endTime) + 3 * 60;

//     if (currentTime >= cooldownEndTime) {
//         try {
//             console.log(`🔢 Finalizing vote tally for proposal ${proposalId}`);
//             const finalizeTx = await mainContract.finalizeProposalVotes(proposalId);
//             await finalizeTx.wait();
//             console.log(`✅ Finalized vote tally for proposal ${proposalId}`);
//             markProposalAsFinalized(proposalId.toString(), cache);
//         } catch (error) {
//             console.error(`❌ Error finalizing proposal ${proposalId}:`, error);
//         }
//     }
// }

// async function mirrorAndFinalizeProposal(
//     contract: ethers.Contract,
//     proposalId: string,
//     proposal: any,
//     chainId: string,
//     isExpired: boolean
// ): Promise<void> {
//     try {
//         const tx = await contract.mirrorProposal(
//             proposalId,
//             proposal.title,
//             proposal.description,
//             proposal.startTime,
//             proposal.endTime
//         );
//         await tx.wait();
//         console.log(`✅ Proposal ${proposalId} mirrored to ${chainId}`);

//         if (isExpired) {
//             const finalizeTx = await contract.finalizeVotes(proposalId);
//             await finalizeTx.wait();
//             console.log(
//                 `✅ Votes finalized for newly mirrored expired proposal ${proposalId} on ${chainId}`
//             );
//         }
//     } catch (error) {
//         console.error(`❌ Error mirroring/finalizing proposal ${proposalId} on ${chainId}:`, error);
//     }
// }

// function setupSecondaryChainEventListeners(
//     mainContract: ethers.Contract,
//     secondaryConnections: Record<string, ContractConnections>
// ) {
//     console.log("🎧 Setting up event listeners for secondary chains");

//     for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
//         contract.on("VotesTallied", async (proposalId, yesVotes, noVotes, event) => {
//             console.log(
//                 `🗳️ Votes tallied for proposal ${proposalId} on ${chainId}: Yes=${yesVotes}, No=${noVotes}`
//             );
//             try {
//                 if (
//                     await checkAndCollectVotes(mainContract, chainId, proposalId, yesVotes, noVotes)
//                 ) {
//                     const proposal = await mainContract.getProposalDetails(proposalId);
//                     if (!proposal.voteTallyFinalized) {
//                         await finalizeVotesIfPossible(
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
//     mainContract: ethers.Contract,
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
//                                 `ℹ️ Proposal ${proposalId} found on ${chainId}, voteTallied: ${secondaryProposal.voteTallied}`
//                             );
//                         } catch (err) {
//                             console.log(`⚠️ Proposal ${proposalId} not found on ${chainId}`);
//                             proposalExists = false;
//                         }

//                         if (!proposalExists || secondaryProposal.startTime === 0n) {
//                             console.log(
//                                 `🔄 Mirroring missing proposal ${proposalId} to ${chainId}`
//                             );
//                             await mirrorAndFinalizeProposal(
//                                 contract,
//                                 proposalId,
//                                 mainProposal,
//                                 chainId,
//                                 isExpired
//                             );
//                         } else if (isExpired && !secondaryProposal.voteTallied) {
//                             console.log(
//                                 `⏳ Proposal ${proposalId} exists but not finalized on ${chainId}, finalizing`
//                             );
//                             try {
//                                 const finalizeTx = await contract.finalizeVotes(proposalId);
//                                 await finalizeTx.wait();
//                                 console.log(
//                                     `✅ Proposal ${proposalId} votes finalized on ${chainId}`
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

// function loadProposalCache(): ProposalCache {
//     try {
//         if (fs.existsSync(CACHE_FILE_PATH)) {
//             return JSON.parse(fs.readFileSync(CACHE_FILE_PATH, "utf8"));
//         }
//     } catch (error) {
//         console.error("Error loading proposal cache:", error);
//     }
//     return { finalized: [], lastUpdate: 0 };
// }

// function saveProposalCache(cache: ProposalCache) {
//     try {
//         fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
//     } catch (error) {
//         console.error("Error saving proposal cache:", error);
//     }
// }

// function markProposalAsFinalized(proposalId: string, cache: ProposalCache) {
//     cache.finalized.push({
//         id: proposalId,
//         timestamp: Math.floor(Date.now() / 1000),
//     });
//     cache.lastUpdate = Math.floor(Date.now() / 1000);
//     saveProposalCache(cache);
// }

// async function processEndedProposals(
//     mainContract: ethers.Contract,
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
//                                 `ℹ️ Proposal ${proposalId} on ${chainId} - VoteTallied: ${secondaryProposal.voteTallied}`
//                             );
//                         } catch (err) {
//                             console.log(`⚠️ Proposal ${proposalId} not found on ${chainId}`);
//                             proposalExists = false;
//                         }

//                         if (!proposalExists || secondaryProposal.startTime === 0n) {
//                             console.log(
//                                 `⚠️ Proposal ${proposalId} missing on ${chainId}, mirroring`
//                             );
//                             await mirrorAndFinalizeProposal(
//                                 contract,
//                                 proposalId,
//                                 mainProposal,
//                                 chainId,
//                                 true
//                             );
//                             secondaryProposal = await contract.getProposalDetails(proposalId);
//                         }

//                         // Check if votes are already collected before proceeding
//                         let votesCollected = false;
//                         try {
//                             const secondaryVotes = await mainContract.secondaryChainVotes(
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
//                             !secondaryProposal.voteTallied &&
//                             Number(secondaryProposal.endTime) <= currentTime
//                         ) {
//                             console.log(`🗳️ Finalizing votes for ${proposalId} on ${chainId}`);
//                             const finalizeTx = await contract.finalizeVotes(proposalId);
//                             await finalizeTx.wait();
//                             console.log(`✅ Votes finalized for ${proposalId} on ${chainId}`);
//                             secondaryProposal = await contract.getProposalDetails(proposalId);
//                         }

//                         if (secondaryProposal.voteTallied && !votesCollected) {
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
//                     }
//                 }

//                 await finalizeVotesIfPossible(
//                     mainContract,
//                     proposalId,
//                     Number(mainProposal.endTime),
//                     cache
//                 );
//             } catch (error) {
//                 console.error(`❌ Error processing proposal ${proposalId}:`, error);
//             }
//         }
//     } catch (error) {
//         console.error("❌ Error processing ended proposals:", error);
//     }
// }

// function setupWebSocketHealthCheck(
//     connections: {
//         main: ContractConnections;
//         secondary: Record<string, ContractConnections>;
//     },
//     options = {
//         checkInterval: 60000,
//         maxReconnectAttempts: 5,
//         reconnectDelay: 5000,
//     }
// ) {
//     const reconnectAttempts: Record<string, number> = {};

//     async function attemptReconnect(chainId: string, isMain: boolean) {
//         const connection = isMain ? connections.main : connections.secondary[chainId];
//         const maxAttempts = options.maxReconnectAttempts;
//         const currentAttempts = reconnectAttempts[chainId] || 0;

//         if (currentAttempts >= maxAttempts) {
//             console.error(`❌ Max reconnection attempts reached for ${chainId}`);
//             return;
//         }

//         reconnectAttempts[chainId] = currentAttempts + 1;

//         try {
//             if (isMain) {
//                 await reconnectMainChain(connections);
//             } else {
//                 await reconnectSecondaryChain(connections, chainId);
//             }
//             reconnectAttempts[chainId] = 0;
//         } catch (error) {
//             console.error(`❌ Reconnection attempt ${currentAttempts + 1} failed for ${chainId}`);
//             setTimeout(() => attemptReconnect(chainId, isMain), options.reconnectDelay);
//         }
//     }

//     setInterval(() => {
//         const mainWs = connections.main.wsInstance;
//         if (
//             !mainWs ||
//             mainWs.readyState === WebSocket.CLOSED ||
//             mainWs.readyState === WebSocket.CLOSING
//         ) {
//             console.log("🔄 Main chain WebSocket disconnected, attempting reconnection...");
//             attemptReconnect("main", true);
//         }
//         for (const [chainId, connection] of Object.entries(connections.secondary)) {
//             const ws = connection.wsInstance;
//             if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
//                 console.log(
//                     `🔄 ${chainId} chain WebSocket disconnected, attempting reconnection...`
//                 );
//                 attemptReconnect(chainId, false);
//             }
//         }
//     }, options.checkInterval);

//     process.on("uncaughtException", (error) => {
//         console.error("Uncaught exception:", error);
//         attemptReconnect("main", true);
//         for (const chainId of Object.keys(connections.secondary)) {
//             attemptReconnect(chainId, false);
//         }
//     });
// }

// async function reconnectMainChain(connections: {
//     main: ContractConnections;
//     secondary: Record<string, ContractConnections>;
// }) {
//     try {
//         await connections.main.provider.destroy();
//         const mainProvider = createWebSocketProvider(CONFIG.MAIN.WS_URL);
//         const mainSigner = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, mainProvider);
//         const mainContract = new ethers.Contract(
//             CONFIG.MAIN.CONTRACT,
//             MAIN_GOVERNANCE_ABI,
//             mainSigner
//         );

//         connections.main = {
//             provider: mainProvider,
//             contract: mainContract,
//             signer: mainSigner,
//             wsInstance: mainProvider.websocket as WebSocket,
//         };

//         setupMainChainEventListeners(mainContract, connections.secondary);
//         console.log("✅ Successfully reconnected to main chain");
//     } catch (error) {
//         throw new Error(`Failed to reconnect to main chain: ${error}`);
//     }
// }

// async function reconnectSecondaryChain(
//     connections: {
//         main: ContractConnections;
//         secondary: Record<string, ContractConnections>;
//     },
//     chainId: string
// ) {
//     try {
//         const chainConfig = CONFIG.SECONDARY_CHAINS.find((c) => c.CHAIN_ID === chainId);
//         if (!chainConfig) throw new Error(`No config for chain ${chainId}`);
//         await connections.secondary[chainId].provider.destroy();
//         const provider = createWebSocketProvider(chainConfig.WS_URL);
//         const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, provider);
//         const contract = new ethers.Contract(
//             chainConfig.CONTRACT,
//             SECONDARY_GOVERNANCE_ABI,
//             signer
//         );

//         connections.secondary[chainId] = {
//             provider,
//             contract,
//             signer,
//             wsInstance: provider.websocket as WebSocket,
//         };

//         setupSecondaryChainEventListeners(connections.main.contract, {
//             [chainId]: connections.secondary[chainId],
//         });

//         console.log(`✅ Successfully reconnected to ${chainId} chain`);
//     } catch (error) {
//         throw new Error(`Failed to reconnect to ${chainId} chain: ${error}`);
//     }
// }

// function scheduleRecurringTasks(
//     mainContract: ethers.Contract,
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
//         setupWebSocketHealthCheck(connections);
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

import { ethers, Log } from "ethers"; // Import Log type
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import WebSocket from "ws";

dotenv.config();

// --- Interfaces ---
interface ContractConnections {
    provider: ethers.WebSocketProvider;
    contract: ethers.Contract;
    signer: ethers.Wallet;
    wsInstance?: WebSocket;
}

interface FinalizedProposal {
    id: string;
    timestamp: number;
}

interface ProposalCache {
    finalized: FinalizedProposal[];
    lastUpdate: number;
}

// Define interfaces for contract proposal structs for better type safety
interface MainProposal {
    id: string;
    proposer: string;
    title: string;
    ipfsCid: string; // Changed from description
    targets: string[];
    values: bigint[];
    calldatas: string[];
    yesVotes: bigint;
    noVotes: bigint;
    startTime: bigint;
    endTime: bigint;
    status: number; // Enum index: 0:Pending, 1:Accepted, 2:Rejected, 3:Executed
    finalYesVotes: bigint;
    finalNoVotes: bigint;
    voteTallyFinalized: boolean;
    executed: boolean;
}

interface SecondaryProposal {
    id: string;
    title: string;
    ipfsCid: string; // Changed from description
    yesVotes: bigint;
    noVotes: bigint;
    startTime: bigint;
    endTime: bigint;
    status: number; // Enum index: 0:Pending, 1:Accepted, 2:Rejected, 3:Executed
    voteTallied: boolean;
}

// --- Configuration ---
const CONFIG = {
    MAIN: {
        CHAIN_ID: "main", // Example ID, logical name
        RPC_URL: process.env.ARB_RPC || "",
        WS_URL: process.env.ARB_WS_URL || "",
        CONTRACT: "0xA58c7e554D10E584b9f13c795272e17986940F34", // Replace with your MainGovernance address
    },
    SECONDARY_CHAINS: [
        {
            CHAIN_ID: "bsc", // Example ID, logical name
            RPC_URL: process.env.BSC_RPC || "",
            WS_URL: process.env.BSC_WS_URL || "",
            CONTRACT: "0xA58c7e554D10E584b9f13c795272e17986940F34", // Replace with your SecondaryGovernance address
        },
        // Add other secondary chains here
    ],
    // Consider moving ABI paths to config if they differ per deployment
};

const CONTRACT_ABIS = {
    MAIN: "../abi/main.json", // !! IMPORTANT: Update this file after compiling contracts !!
    SECONDARY: "../abi/secondary.json", // !! IMPORTANT: Update this file after compiling contracts !!
};

const MAIN_GOVERNANCE_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, CONTRACT_ABIS.MAIN), "utf8")
);
const SECONDARY_GOVERNANCE_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, CONTRACT_ABIS.SECONDARY), "utf8")
);

const CACHE_FILE_PATH = path.join(__dirname, "proposal_cache.json");
const MAIN_CHAIN_COOLDOWN_SECONDS = 1 * 60; // Match the 1 minute cooldown in MainGovernance.sol

// --- Helper Functions ---

function createWebSocketProvider(wsUrl: string): ethers.WebSocketProvider {
    // Ensure wsUrl is provided
    if (!wsUrl) {
        throw new Error("WebSocket URL is missing. Check your .env file and CONFIG.");
    }
    console.log(`Attempting to connect WebSocket to: ${wsUrl}`); // Log connection attempt

    const ws = new WebSocket(wsUrl, {
        // Removed unsupported 'timeout' option, handle via ping/pong or connection checks
        perMessageDeflate: false,
        // Add handshake timeout if needed and supported by 'ws' version, or handle elsewhere
        // handshakeTimeout: 30000, // Example, check ws docs if using
    });

    const provider = new ethers.WebSocketProvider(ws as any, undefined); // Let ethers handle polling interval

    ws.on("open", () => {
        console.log(`WebSocket opened for ${wsUrl}`);
        // Implement ping interval if needed for keep-alive
        // const pingInterval = setInterval(() => {
        //     if (ws.readyState === WebSocket.OPEN) {
        //         ws.ping();
        //     } else {
        //         clearInterval(pingInterval);
        //     }
        // }, 30000); // Send ping every 30 seconds
    });

    ws.on("ping", () => {
        ws.pong(); // Respond to pings
    });

    ws.on("error", (error) => {
        console.error(`WebSocket error for ${wsUrl}:`, error.message);
        // Consider triggering reconnection logic here as well
    });

    ws.on("close", (code, reason) => {
        console.log(
            `WebSocket closed for ${wsUrl}. Code: ${code}, Reason: ${
                reason ? reason.toString() : "No reason provided"
            }. Will rely on health check to reconnect...`
        );
        // Clean up intervals if any were set
    });

    return provider;
}

async function initializeContracts(): Promise<{
    main: ContractConnections;
    secondary: Record<string, ContractConnections>;
}> {
    if (!process.env.RELAYER_PVT_KEY) {
        throw new Error("RELAYER_PVT_KEY is not set in environment variables");
    }
    console.log("Initializing contract connections...");

    let mainProvider: ethers.WebSocketProvider;
    let mainSigner: ethers.Wallet;
    let mainContract: ethers.Contract;

    try {
        mainProvider = createWebSocketProvider(CONFIG.MAIN.WS_URL);
        mainSigner = new ethers.Wallet(process.env.RELAYER_PVT_KEY, mainProvider);
        mainContract = new ethers.Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);
        await mainProvider.ready; // Wait for provider connection
        console.log(`🔗 Connected to Main chain (${CONFIG.MAIN.CHAIN_ID})`);
    } catch (error: any) {
        console.error(
            `❌ FATAL: Failed to connect to Main chain (${CONFIG.MAIN.CHAIN_ID}):`,
            error.message
        );
        // Depending on desired robustness, you might exit or implement retries here
        throw new Error(`Main chain connection failed: ${error.message}`); // Rethrow to halt initialization
    }

    const secondaryConnections: Record<string, ContractConnections> = {};
    for (const chain of CONFIG.SECONDARY_CHAINS) {
        try {
            const provider = createWebSocketProvider(chain.WS_URL);
            const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY, provider);
            const contract = new ethers.Contract(chain.CONTRACT, SECONDARY_GOVERNANCE_ABI, signer);
            await provider.ready; // Wait for provider connection

            secondaryConnections[chain.CHAIN_ID] = {
                provider,
                contract,
                signer,
                wsInstance: provider.websocket as WebSocket,
            };
            console.log(`🔌 Connected to Secondary chain (${chain.CHAIN_ID})`);
        } catch (error: any) {
            console.error(
                `❌ Failed to connect to Secondary chain (${chain.CHAIN_ID}):`,
                error.message
            );
            // Decide if failure on one secondary chain should halt the relayer
            // For MVP, logging error might be sufficient, relayer continues with others
        }
    }

    return {
        main: {
            provider: mainProvider,
            contract: mainContract,
            signer: mainSigner,
            wsInstance: mainProvider.websocket as WebSocket,
        },
        secondary: secondaryConnections,
    };
}

// --- Event Listener Setup ---

function setupMainChainEventListeners(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🎧 Setting up event listeners for Main chain");

    // --- UPDATED ProposalCreated Listener ---
    // Ensure ABI is updated for this event signature:
    // event ProposalCreated(bytes32 id, address proposer, address[] targets, uint256[] values, bytes[] calldatas, uint256 startTime, uint256 endTime, string title, string ipfsCid);
    mainContract.on(
        "ProposalCreated",
        async (
            id: string,
            proposer: string,
            targets: string[], // Added based on latest contract
            values: bigint[], // Added based on latest contract
            calldatas: string[], // Added based on latest contract
            startTime: bigint, // Added based on latest contract (was implicit before)
            endTime: bigint,
            title: string,
            ipfsCid: string, // Changed from description based on latest contract
            event: Log // Ethers v6 provides the full Log object
        ) => {
            const blockNumber = event.blockNumber; // Get block number from Log object
            console.log(
                `🆕 ProposalCreated event detected (Block: ${blockNumber}): ID=${id}, Title=${title}`
            );

            try {
                // Fetch proposal details to ensure we have all info (esp. if event signature was simplified)
                // Though with the full event signature, we technically have most details needed for mirroring
                const mainProposal: MainProposal = await mainContract.getProposalDetails(id);
                if (!mainProposal || mainProposal.startTime === 0n) {
                    console.error(
                        `❌ Failed to fetch details or proposal invalid for ID ${id} immediately after creation event.`
                    );
                    return; // Avoid processing potentially invalid data
                }

                // Mirror to all connected secondary chains
                for (const [chainId, connection] of Object.entries(secondaryConnections)) {
                    // Check if connection exists and is valid
                    if (!connection || !connection.contract) {
                        console.warn(`❓ Skipping mirroring to ${chainId}: No valid connection.`);
                        continue;
                    }
                    const { contract: secondaryContract } = connection;
                    try {
                        console.log(`   -> Checking proposal ${id} on secondary chain ${chainId}`);
                        let secondaryProposal: SecondaryProposal | null = null;
                        try {
                            secondaryProposal = await secondaryContract.getProposalDetails(id);
                        } catch (err) {
                            // Proposal likely doesn't exist, which is expected
                            console.log(
                                `   -> Proposal ${id} not found on ${chainId}, proceeding to mirror.`
                            );
                        }

                        if (secondaryProposal && secondaryProposal.startTime > 0n) {
                            console.log(
                                `   -> ℹ️ Proposal ${id} already exists on ${chainId}. Skipping mirror.`
                            );
                            continue;
                        }

                        console.log(
                            `   -> 🔄 Mirroring proposal ${id} ('${mainProposal.title}') to ${chainId}`
                        );
                        // --- UPDATED mirrorProposal call ---
                        const tx = await secondaryContract.mirrorProposal(
                            id,
                            mainProposal.title,
                            mainProposal.ipfsCid, // Use ipfsCid
                            mainProposal.startTime,
                            mainProposal.endTime
                        );
                        const receipt = await tx.wait();
                        console.log(
                            `   -> ✅ Proposal ${id} mirrored to ${chainId} (Tx: ${receipt?.hash})`
                        );
                    } catch (error: any) {
                        console.error(
                            `   -> ❌ Error mirroring proposal ${id} to ${chainId}:`,
                            error.reason || error.message
                        );
                        // Consider adding retry logic here for temporary network issues
                    }
                }
            } catch (error: any) {
                console.error(
                    `❌ Error processing ProposalCreated event for ID ${id}:`,
                    error.reason || error.message
                );
            }
        }
    );

    // --- UPDATED Status Listener ---
    // Listen for the final outcome determination
    mainContract.on("ProposalOutcomeDetermined", async (id: string, status: number, event: Log) => {
        // Enum: 0:Pending, 1:Accepted, 2:Rejected, 3:Executed
        const statusString = ["Pending", "Accepted", "Rejected", "Executed"][status] || "Unknown";
        console.log(
            `⚖️ ProposalOutcomeDetermined event detected (Block: ${event.blockNumber}): ID=${id}, Status=${statusString}(${status})`
        );

        // We only care about Rejected here, as Accepted leads to Execution or queuing
        if (status === 2 /* Rejected */) {
            console.log(`   -> Propagating REJECTED status for ${id} to secondary chains.`);
            for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                if (!contract) continue;
                try {
                    // Check if status is already updated to prevent redundant calls
                    const secondaryProposal: SecondaryProposal = await contract.getProposalDetails(
                        id
                    );
                    if (secondaryProposal.status === status) {
                        console.log(
                            `   -> ℹ️ Status already ${statusString} on ${chainId} for proposal ${id}.`
                        );
                        continue;
                    }
                    if (secondaryProposal.status !== 0 /* Pending */) {
                        console.warn(
                            `   -> ⚠️ Attempting to update status on ${chainId} for proposal ${id} from ${secondaryProposal.status} to ${statusString}. This might indicate an issue.`
                        );
                        // Depending on strictness, you might skip or proceed
                    }

                    console.log(
                        `   -> 🔄 Updating proposal ${id} status to ${statusString} on ${chainId}`
                    );
                    const tx = await contract.updateProposalStatus(id, status);
                    const receipt = await tx.wait();
                    console.log(`   -> ✅ Status updated on ${chainId} (Tx: ${receipt?.hash})`);
                } catch (error: any) {
                    console.error(
                        `   -> ❌ Error updating REJECTED status on ${chainId} for proposal ${id}:`,
                        error.reason || error.message
                    );
                }
            }
        } else {
            console.log(
                `   -> Outcome is ${statusString}. Waiting for execution event if applicable.`
            );
        }
    });

    // Listen for successful execution
    mainContract.on("ProposalActionsExecuted", async (id: string, event: Log) => {
        const executedStatus = 3; // Enum index for Executed
        const statusString = "Executed";
        console.log(
            `🚀 ProposalActionsExecuted event detected (Block: ${event.blockNumber}): ID=${id}`
        );
        console.log(`   -> Propagating EXECUTED status for ${id} to secondary chains.`);

        for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
            if (!contract) continue;
            try {
                // Check if status is already updated
                const secondaryProposal: SecondaryProposal = await contract.getProposalDetails(id);
                if (secondaryProposal.status === executedStatus) {
                    console.log(
                        `   -> ℹ️ Status already ${statusString} on ${chainId} for proposal ${id}.`
                    );
                    continue;
                }
                // It should ideally be Accepted (1) or maybe still Pending (0) if updates raced
                if (secondaryProposal.status !== 1 && secondaryProposal.status !== 0) {
                    console.warn(
                        `   -> ⚠️ Attempting to update status on ${chainId} for proposal ${id} from ${secondaryProposal.status} to ${statusString}. This might indicate an issue.`
                    );
                }

                console.log(
                    `   -> 🔄 Updating proposal ${id} status to ${statusString} on ${chainId}`
                );
                const tx = await contract.updateProposalStatus(id, executedStatus);
                const receipt = await tx.wait();
                console.log(`   -> ✅ Status updated on ${chainId} (Tx: ${receipt?.hash})`);
            } catch (error: any) {
                console.error(
                    `   -> ❌ Error updating EXECUTED status on ${chainId} for proposal ${id}:`,
                    error.reason || error.message
                );
            }
        }
    });

    // Remove the old "ProposalExecuted" listener if it existed
    // mainContract.off("ProposalExecuted"); // Turn off old listener if applicable
}

function setupSecondaryChainEventListeners(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🎧 Setting up event listeners for Secondary chains");

    for (const [chainId, connection] of Object.entries(secondaryConnections)) {
        if (!connection || !connection.contract) {
            console.warn(`❓ Skipping listeners for ${chainId}: No valid connection.`);
            continue;
        }
        const { contract: secondaryContract } = connection;

        secondaryContract.on(
            "VotesTallied",
            async (proposalId: string, yesVotes: bigint, noVotes: bigint, event: Log) => {
                console.log(
                    `🗳️ VotesTallied event detected on ${chainId} (Block: ${event.blockNumber}): ID=${proposalId}, Yes=${yesVotes}, No=${noVotes}`
                );
                try {
                    // Attempt to collect votes on the main chain
                    const collected = await checkAndCollectVotes(
                        mainContract,
                        chainId,
                        proposalId,
                        yesVotes,
                        noVotes
                    );

                    if (collected) {
                        // If votes were successfully collected (or already were), check if main proposal can be finalized
                        const mainProposal: MainProposal = await mainContract.getProposalDetails(
                            proposalId
                        );
                        if (!mainProposal.voteTallyFinalized) {
                            console.log(
                                `   -> Checking if proposal ${proposalId} can be finalized on main chain...`
                            );
                            await finalizeVotesIfPossible(
                                mainContract,
                                proposalId,
                                Number(mainProposal.endTime), // Use proposal's endTime
                                loadProposalCache()
                            );
                        } else {
                            console.log(
                                `   -> Proposal ${proposalId} vote tally already finalized on main chain.`
                            );
                        }
                    }
                } catch (error: any) {
                    console.error(
                        `❌ Error processing VotesTallied event from ${chainId} for proposal ${proposalId}:`,
                        error.reason || error.message
                    );
                }
            }
        );
    }
}

// --- Vote Collection & Finalization Logic ---

async function checkAndCollectVotes(
    mainContract: ethers.Contract,
    chainId: string,
    proposalId: string,
    yesVotes: bigint,
    noVotes: bigint
): Promise<boolean> {
    console.log(
        `   -> Checking collection status for ${proposalId} from ${chainId} on main chain.`
    );
    try {
        // Check if votes are already marked as collected on the main chain
        const voteSummary = await mainContract.secondaryChainVotes(proposalId, chainId);
        if (voteSummary && voteSummary.collected) {
            console.log(
                `   -> ℹ️ Votes already collected from ${chainId} for proposal ${proposalId} on main chain.`
            );
            return true; // Indicate collected (or already collected)
        }
    } catch (error: any) {
        // Handle cases where the mapping might not be initialized or other view errors
        if (!error.message.includes("call revert exception")) {
            // Avoid logging expected "not found" errors if applicable
            console.warn(
                `   -> Warning checking vote collection status for ${proposalId} from ${chainId}:`,
                error.message
            );
        } else {
            console.log(
                `   -> Vote summary for ${proposalId} from ${chainId} likely not yet present on main chain.`
            );
        }
        // Proceed to attempt collection
    }

    try {
        console.log(
            `   -> 🗳️ Attempting to collect votes from ${chainId} for proposal ${proposalId} on main chain.`
        );
        const tx = await mainContract.collectSecondaryChainVotes(
            proposalId,
            chainId,
            yesVotes,
            noVotes
        );
        const receipt = await tx.wait();
        console.log(
            `   -> ✅ Collected votes from ${chainId} for proposal ${proposalId} (Tx: ${receipt?.hash})`
        );
        return true; // Indicate successfully collected now
    } catch (err: any) {
        // Handle specific "already collected" error non-fatally
        const reason = err.reason || err.message || "";
        if (reason.toLowerCase().includes("votes already collected")) {
            console.log(
                `   -> ℹ️ Votes already collected from ${chainId} for proposal ${proposalId} (caught during transaction).`
            );
            return true; // Indicate collected (race condition likely)
        }
        // Handle potential revert if tally already finalized on main chain
        else if (reason.toLowerCase().includes("tally finalized")) {
            console.warn(
                `   -> ⚠️ Failed to collect votes from ${chainId} for ${proposalId}: Main chain tally already finalized.`
            );
            return false; // Indicate collection failed because it's too late
        }
        // Log other errors and indicate failure
        console.error(
            `   -> ❌ Error in collectSecondaryChainVotes from ${chainId} for ${proposalId}:`,
            reason
        );
        // Consider re-throwing for critical errors, or return false for transient ones
        // throw err; // Option: re-throw for critical investigation
        return false; // Indicate collection failed
    }
}

// --- UPDATED Cooldown Logic ---
async function finalizeVotesIfPossible(
    mainContract: ethers.Contract,
    proposalId: string,
    proposalEndTime: number, // Use the actual end time from the proposal
    cache: ProposalCache
): Promise<void> {
    const currentTime = Math.floor(Date.now() / 1000);
    // Use the contract's cooldown period
    const cooldownEndTime = proposalEndTime + MAIN_CHAIN_COOLDOWN_SECONDS;

    console.log(
        `   -> Checking finalization conditions for ${proposalId}: CurrentTime=${currentTime}, CooldownEndTime=${cooldownEndTime}`
    );

    if (currentTime >= cooldownEndTime) {
        try {
            // Double-check proposal status before finalizing
            const proposal: MainProposal = await mainContract.getProposalDetails(proposalId);
            if (proposal.status !== 0 /* Pending */) {
                console.log(
                    `   -> ℹ️ Proposal ${proposalId} is no longer Pending (Status: ${proposal.status}). Skipping finalization attempt.`
                );
                if (
                    proposal.voteTallyFinalized &&
                    !cache.finalized.some((p) => p.id === proposalId)
                ) {
                    // If somehow finalized but not cached, update cache
                    markProposalAsFinalized(proposalId.toString(), cache);
                }
                return;
            }
            if (proposal.voteTallyFinalized) {
                console.log(
                    `   -> ℹ️ Proposal ${proposalId} vote tally already finalized but status is still Pending? Might be mid-execution or edge case.`
                );
                // Avoid calling finalize again if tally is done but status update is pending/failed
                return;
            }

            console.log(
                `   -> 🔢 Attempting to finalize vote tally for proposal ${proposalId} on main chain.`
            );
            const finalizeTx = await mainContract.finalizeProposalVotes(proposalId);
            const receipt = await finalizeTx.wait();
            console.log(
                `   -> ✅ Successfully finalized vote tally for proposal ${proposalId} (Tx: ${receipt?.hash})`
            );

            // Mark as finalized in cache AFTER successful transaction
            markProposalAsFinalized(proposalId.toString(), cache);
            // Note: The status (Accepted/Rejected/Executed) will be handled by event listeners
        } catch (error: any) {
            const reason = error.reason || error.message || "";
            // Handle expected reverts gracefully
            if (reason.toLowerCase().includes("cooldown active")) {
                console.log(
                    `   -> ℹ️ Finalization attempt failed for ${proposalId}: Cooldown still active (timing edge case?).`
                );
            } else if (reason.toLowerCase().includes("proposal not pending")) {
                console.log(
                    `   -> ℹ️ Finalization attempt failed for ${proposalId}: Proposal no longer pending.`
                );
            } else if (reason.toLowerCase().includes("already finalized")) {
                console.log(
                    `   -> ℹ️ Finalization attempt failed for ${proposalId}: Already finalized (race condition?).`
                );
                // Attempt to mark in cache just in case
                try {
                    const proposal = await mainContract.getProposalDetails(proposalId);
                    if (
                        proposal.voteTallyFinalized &&
                        !cache.finalized.some((p) => p.id === proposalId)
                    ) {
                        markProposalAsFinalized(proposalId.toString(), cache);
                    }
                } catch {} // Ignore errors fetching details here
            } else {
                // Log unexpected errors
                console.error(
                    `   -> ❌ Error finalizing proposal ${proposalId} on main chain:`,
                    reason
                );
            }
        }
    } else {
        console.log(
            `   -> Cooldown not ended for proposal ${proposalId}. Skipping finalization check.`
        );
    }
}

// --- Proposal Syncing & Mirroring ---

// --- UPDATED mirrorAndFinalizeProposal call ---
async function mirrorAndFinalizeProposal(
    secondaryContract: ethers.Contract, // Renamed param for clarity
    proposalId: string,
    mainProposal: MainProposal, // Use defined interface
    chainId: string, // Added chainId for logging
    isExpired: boolean
): Promise<boolean> {
    // Return boolean for success/failure
    try {
        console.log(`   -> 🔄 Mirroring proposal ${proposalId} to ${chainId}...`);
        const mirrorTx = await secondaryContract.mirrorProposal(
            proposalId,
            mainProposal.title,
            mainProposal.ipfsCid, // Use ipfsCid
            mainProposal.startTime,
            mainProposal.endTime
        );
        const mirrorReceipt = await mirrorTx.wait();
        console.log(
            `   -> ✅ Proposal ${proposalId} mirrored to ${chainId} (Tx: ${mirrorReceipt?.hash})`
        );

        // If the proposal's voting period already ended *before* mirroring, finalize local votes immediately
        if (isExpired) {
            console.log(
                `   -> 🗳️ Proposal ${proposalId} is expired, attempting immediate vote finalization on ${chainId}...`
            );
            // Add check if already tallied to avoid errors
            const secondaryProposal: SecondaryProposal = await secondaryContract.getProposalDetails(
                proposalId
            );
            if (!secondaryProposal.voteTallied) {
                const finalizeTx = await secondaryContract.finalizeVotes(proposalId);
                const finalizeReceipt = await finalizeTx.wait();
                console.log(
                    `   -> ✅ Votes finalized for newly mirrored (expired) proposal ${proposalId} on ${chainId} (Tx: ${finalizeReceipt?.hash})`
                );
            } else {
                console.log(
                    `   -> ℹ️ Votes already tallied for newly mirrored (expired) proposal ${proposalId} on ${chainId}.`
                );
            }
        }
        return true; // Mirroring (and potential finalization) succeeded
    } catch (error: any) {
        const reason = error.reason || error.message || "";
        // Handle "already mirrored" gracefully
        if (reason.toLowerCase().includes("already mirrored")) {
            console.log(
                `   -> ℹ️ Proposal ${proposalId} already mirrored on ${chainId} (caught during transaction).`
            );
            // If it's already mirrored and expired, still try to finalize votes if needed
            if (isExpired) {
                try {
                    const secondaryProposal: SecondaryProposal =
                        await secondaryContract.getProposalDetails(proposalId);
                    if (!secondaryProposal.voteTallied) {
                        console.log(
                            `   -> 🗳️ Expired proposal ${proposalId} already mirrored, attempting vote finalization on ${chainId}...`
                        );
                        const finalizeTx = await secondaryContract.finalizeVotes(proposalId);
                        await finalizeTx.wait();
                        console.log(
                            `   -> ✅ Votes finalized for existing (expired) proposal ${proposalId} on ${chainId}.`
                        );
                    }
                } catch (finalizeError: any) {
                    console.error(
                        `   -> ❌ Error finalizing votes for existing expired proposal ${proposalId} on ${chainId}:`,
                        finalizeError.reason || finalizeError.message
                    );
                }
            }
            return true; // Consider it "successful" as the desired state (mirrored) exists
        }
        // Handle finalize votes errors if mirroring succeeded but finalization failed
        else if (reason.toLowerCase().includes("already tallied")) {
            console.log(
                `   -> ℹ️ Votes already tallied for proposal ${proposalId} on ${chainId} (caught during expired finalization).`
            );
            return true; // Mirroring succeeded
        }
        // Log other errors
        console.error(
            `   -> ❌ Error during mirror/finalize for proposal ${proposalId} on ${chainId}:`,
            reason
        );
        return false; // Indicate failure
    }
}

async function syncExistingProposals(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>,
    cache: ProposalCache // Pass cache to avoid reloading
) {
    console.log("🔄 Syncing existing proposals from main chain...");
    const finalizedIds = new Set(cache.finalized.map((p) => p.id));
    let proposalsProcessed = 0;
    let proposalsSkipped = 0;
    let proposalsMirrored = 0;
    let proposalsFinalized = 0;
    let proposalsStatusUpdated = 0;

    try {
        const proposalIds: string[] = await mainContract.getProposalIds();
        console.log(`   -> Found ${proposalIds.length} proposals on main chain.`);
        const currentTime = Math.floor(Date.now() / 1000);

        for (const proposalId of proposalIds) {
            proposalsProcessed++;
            // Skip if proposal is marked as finalized in cache
            if (finalizedIds.has(proposalId.toString())) {
                proposalsSkipped++;
                // console.log(`   -> ⏩ Skipping cached finalized proposal ${proposalId}`);
                continue;
            }

            try {
                const mainProposal: MainProposal = await mainContract.getProposalDetails(
                    proposalId
                );

                // If finalized on-chain but not in cache, update cache and skip
                if (mainProposal.voteTallyFinalized) {
                    // Use voteTallyFinalized as the primary finalization marker
                    if (!finalizedIds.has(proposalId.toString())) {
                        markProposalAsFinalized(proposalId.toString(), cache);
                        finalizedIds.add(proposalId.toString()); // Add to current run's set
                        console.log(
                            `   -> Cache updated for on-chain finalized proposal ${proposalId}.`
                        );
                    }
                    proposalsSkipped++;
                    // console.log(`   -> ⏩ Skipping on-chain finalized proposal ${proposalId}`);
                    continue;
                }

                console.log(
                    `   -> 🔍 Processing proposal ${proposalId} ('${mainProposal.title}')...`
                );
                const isExpired = Number(mainProposal.endTime) <= currentTime;

                for (const [chainId, connection] of Object.entries(secondaryConnections)) {
                    if (!connection || !connection.contract) continue;
                    const { contract: secondaryContract } = connection;
                    try {
                        let secondaryProposal: SecondaryProposal | null = null;
                        let proposalExists = false;
                        // console.log(`      -> Checking proposal ${proposalId} on ${chainId}`);
                        try {
                            secondaryProposal = await secondaryContract.getProposalDetails(
                                proposalId
                            );
                            if (secondaryProposal && secondaryProposal.startTime > 0n) {
                                proposalExists = true;
                                // console.log(`      -> Found on ${chainId}, VoteTallied: ${secondaryProposal.voteTallied}, Status: ${secondaryProposal.status}`);
                            } else {
                                console.log(
                                    `      -> Proposal ${proposalId} query returned invalid data on ${chainId}. Treating as non-existent.`
                                );
                            }
                        } catch (err) {
                            // console.log(`      -> Not found on ${chainId}.`);
                            // Expected if not mirrored yet
                        }

                        // 1. Mirror if doesn't exist
                        if (!proposalExists) {
                            console.log(
                                `      -> Mirroring needed for ${proposalId} on ${chainId}.`
                            );
                            const mirrored = await mirrorAndFinalizeProposal(
                                secondaryContract,
                                proposalId,
                                mainProposal,
                                chainId,
                                isExpired
                            );
                            if (mirrored) proposalsMirrored++;
                            // Fetch again after mirroring if needed for subsequent steps
                            if (mirrored && isExpired) {
                                try {
                                    secondaryProposal = await secondaryContract.getProposalDetails(
                                        proposalId
                                    );
                                } catch {}
                            }
                        }
                        // 2. Finalize votes on secondary if expired but not tallied locally
                        else if (isExpired && secondaryProposal && !secondaryProposal.voteTallied) {
                            console.log(
                                `      -> Finalizing votes needed for expired ${proposalId} on ${chainId}.`
                            );
                            try {
                                const finalizeTx = await secondaryContract.finalizeVotes(
                                    proposalId
                                );
                                await finalizeTx.wait();
                                console.log(
                                    `      -> ✅ Votes finalized for existing expired proposal ${proposalId} on ${chainId}.`
                                );
                                proposalsFinalized++;
                                // Update local view of proposal
                                if (secondaryProposal) secondaryProposal.voteTallied = true;
                            } catch (error: any) {
                                const reason = error.reason || error.message || "";
                                if (reason.toLowerCase().includes("already tallied")) {
                                    console.log(
                                        `      -> ℹ️ Votes already tallied for ${proposalId} on ${chainId} (caught during sync).`
                                    );
                                    if (secondaryProposal) secondaryProposal.voteTallied = true; // Correct local state
                                } else {
                                    console.error(
                                        `      -> ❌ Failed to finalize existing proposal ${proposalId} on ${chainId}:`,
                                        reason
                                    );
                                }
                            }
                        }
                        // 3. Update status if main chain status is final (Rejected/Executed) and differs
                        else if (
                            secondaryProposal &&
                            (mainProposal.status === 2 /* Rejected */ ||
                                mainProposal.status === 3) /* Executed */ &&
                            mainProposal.status !== secondaryProposal.status
                        ) {
                            console.log(
                                `      -> Status update needed for ${proposalId} on ${chainId} (Main: ${mainProposal.status}, Secondary: ${secondaryProposal.status}).`
                            );
                            try {
                                const tx = await secondaryContract.updateProposalStatus(
                                    proposalId,
                                    mainProposal.status
                                );
                                await tx.wait();
                                console.log(
                                    `      -> ✅ Status updated for proposal ${proposalId} to ${mainProposal.status} on ${chainId}.`
                                );
                                proposalsStatusUpdated++;
                            } catch (error: any) {
                                console.error(
                                    `      -> ❌ Error updating status for proposal ${proposalId} on ${chainId}:`,
                                    error.reason || error.message
                                );
                            }
                        }
                        // else {
                        //     console.log(`      -> ✅ Proposal ${proposalId} appears up-to-date on ${chainId}.`);
                        // }
                    } catch (error: any) {
                        // Catch errors specific to processing one chain
                        console.error(
                            `   -> ❌ Error processing proposal ${proposalId} for secondary chain ${chainId}:`,
                            error.reason || error.message
                        );
                    }
                } // End loop through secondary chains
            } catch (error: any) {
                // Catch errors fetching/processing one proposal
                console.error(
                    `❌ Error processing proposal ${proposalId} on main chain:`,
                    error.reason || error.message
                );
            }
        } // End loop through proposal IDs
        console.log(
            `🔄 Sync finished. Processed: ${proposalsProcessed}, Skipped (cached/finalized): ${proposalsSkipped}, Mirrored: ${proposalsMirrored}, Votes Finalized: ${proposalsFinalized}, Status Updates: ${proposalsStatusUpdated}`
        );
    } catch (error: any) {
        // Catch errors fetching proposal IDs etc.
        console.error("❌ Error during proposal sync:", error.message);
    }
}

async function processEndedProposals(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>,
    cache: ProposalCache // Pass cache
) {
    console.log("⏳ Processing ended proposals for vote finalization/collection...");
    const finalizedIds = new Set(cache.finalized.map((p) => p.id));
    let proposalsProcessed = 0;
    let secondaryVotesFinalized = 0;
    let votesCollectedToMain = 0;
    let mainProposalsFinalized = 0;

    try {
        const proposalIds: string[] = await mainContract.getProposalIds();
        console.log(`   -> Checking ${proposalIds.length} proposals from main chain.`);
        const currentTime = Math.floor(Date.now() / 1000);

        for (const proposalId of proposalIds) {
            proposalsProcessed++;
            // Skip if already marked finalized in cache
            if (finalizedIds.has(proposalId.toString())) {
                continue;
            }

            try {
                const mainProposal: MainProposal = await mainContract.getProposalDetails(
                    proposalId
                );

                // Skip if voting period not ended OR if already finalized on main chain
                if (Number(mainProposal.endTime) > currentTime || mainProposal.voteTallyFinalized) {
                    // If finalized on chain but not cache, update cache
                    if (
                        mainProposal.voteTallyFinalized &&
                        !finalizedIds.has(proposalId.toString())
                    ) {
                        markProposalAsFinalized(proposalId.toString(), cache);
                        finalizedIds.add(proposalId.toString());
                        console.log(
                            `   -> Cache updated for on-chain finalized proposal ${proposalId} during ended check.`
                        );
                    }
                    continue;
                }

                // --- Process each registered secondary chain for this ended proposal ---
                console.log(
                    `   -> Processing ended proposal ${proposalId} ('${mainProposal.title}')...`
                );
                const registeredChains: string[] = await mainContract.getRegisteredChains();
                let allVotesCollectedOrTallied = true; // Assume true until proven otherwise

                for (const chainId of registeredChains) {
                    if (!secondaryConnections[chainId] || !secondaryConnections[chainId].contract) {
                        console.warn(
                            `      -> Skipping chain ${chainId} for ${proposalId}: No connection.`
                        );
                        allVotesCollectedOrTallied = false; // Cannot confirm this chain
                        continue;
                    }
                    const { contract: secondaryContract } = secondaryConnections[chainId];

                    try {
                        let secondaryProposal: SecondaryProposal | null = null;
                        let voteSummaryOnMain = null;
                        let votesCollectedOnMain = false;

                        // Check secondary proposal status
                        try {
                            secondaryProposal = await secondaryContract.getProposalDetails(
                                proposalId
                            );
                        } catch (err) {
                            console.warn(
                                `      -> ⚠️ Proposal ${proposalId} missing on secondary chain ${chainId}. Attempting to mirror (likely sync issue).`
                            );
                            // Attempt to mirror expired proposal now
                            const mirrored = await mirrorAndFinalizeProposal(
                                secondaryContract,
                                proposalId,
                                mainProposal,
                                chainId,
                                true
                            );
                            if (mirrored) {
                                try {
                                    secondaryProposal = await secondaryContract.getProposalDetails(
                                        proposalId
                                    );
                                } catch {}
                            } else {
                                allVotesCollectedOrTallied = false; // Failed to ensure state
                                continue; // Skip further processing for this chain on this run
                            }
                        }
                        if (!secondaryProposal) {
                            console.error(
                                `      -> ❌ Failed to get proposal details for ${proposalId} on ${chainId} even after potential mirror attempt.`
                            );
                            allVotesCollectedOrTallied = false;
                            continue;
                        }

                        // Check main chain collection status
                        try {
                            voteSummaryOnMain = await mainContract.secondaryChainVotes(
                                proposalId,
                                chainId
                            );
                            votesCollectedOnMain = voteSummaryOnMain?.collected ?? false;
                        } catch {
                            // Ignore errors, assume not collected if check fails
                        }

                        // If votes already collected on main, skip further actions for this chain
                        if (votesCollectedOnMain) {
                            // console.log(`      -> Votes from ${chainId} for ${proposalId} already collected on main. Skipping.`);
                            continue;
                        }

                        // If not tallied locally on secondary, try to finalize now
                        if (!secondaryProposal.voteTallied) {
                            console.log(
                                `      -> Finalizing local votes for ${proposalId} on ${chainId}...`
                            );
                            try {
                                const finalizeTx = await secondaryContract.finalizeVotes(
                                    proposalId
                                );
                                await finalizeTx.wait();
                                console.log(
                                    `      -> ✅ Local votes finalized for ${proposalId} on ${chainId}.`
                                );
                                secondaryProposal.voteTallied = true; // Update local view
                                secondaryVotesFinalized++;
                            } catch (error: any) {
                                const reason = error.reason || error.message || "";
                                if (reason.toLowerCase().includes("already tallied")) {
                                    console.log(
                                        `      -> ℹ️ Local votes already tallied for ${proposalId} on ${chainId} (caught during processing).`
                                    );
                                    secondaryProposal.voteTallied = true; // Correct local state
                                } else {
                                    console.error(
                                        `      -> ❌ Error finalizing local votes for ${proposalId} on ${chainId}:`,
                                        reason
                                    );
                                    allVotesCollectedOrTallied = false; // Cannot proceed if finalization fails
                                    continue; // Skip collection attempt if finalization failed
                                }
                            }
                        }

                        // If tallied locally but not collected on main, collect now
                        if (secondaryProposal.voteTallied && !votesCollectedOnMain) {
                            console.log(
                                `      -> Collecting votes for ${proposalId} from ${chainId} to main chain...`
                            );
                            const collected = await checkAndCollectVotes(
                                mainContract,
                                chainId,
                                proposalId,
                                secondaryProposal.yesVotes,
                                secondaryProposal.noVotes
                            );
                            if (collected) {
                                votesCollectedToMain++;
                            } else {
                                allVotesCollectedOrTallied = false; // Collection failed
                            }
                        } else if (!secondaryProposal.voteTallied) {
                            // This case means finalization failed above or wasn't attempted
                            allVotesCollectedOrTallied = false;
                            console.log(
                                `      -> Local votes not tallied for ${proposalId} on ${chainId}, cannot collect yet.`
                            );
                        }
                    } catch (error: any) {
                        // Catch errors processing one chain
                        console.error(
                            `   -> ❌ Error processing chain ${chainId} for ended proposal ${proposalId}:`,
                            error.reason || error.message
                        );
                        allVotesCollectedOrTallied = false; // Assume failure if error occurs
                    }
                } // End loop through secondary chains for one proposal

                // --- Attempt Main Chain Finalization ---
                // Try to finalize if cooldown passed (checked inside finalizeVotesIfPossible)
                // No need to check allVotesCollectedOrTallied here, finalizeVotesIfPossible handles proposal state
                console.log(
                    `   -> Checking main chain finalization possibility for ${proposalId}...`
                );
                await finalizeVotesIfPossible(
                    mainContract,
                    proposalId,
                    Number(mainProposal.endTime),
                    cache
                );
                // Check status again after attempt
                try {
                    const updatedMainProposal = await mainContract.getProposalDetails(proposalId);
                    if (
                        updatedMainProposal.voteTallyFinalized &&
                        !finalizedIds.has(proposalId.toString())
                    ) {
                        mainProposalsFinalized++;
                        // Cache update is handled within finalizeVotesIfPossible
                    }
                } catch {} // Ignore final check error
            } catch (error: any) {
                // Catch errors processing one proposal
                console.error(
                    `❌ Error processing ended proposal ${proposalId}:`,
                    error.reason || error.message
                );
            }
        } // End loop through proposals
        console.log(
            `⏳ Ended proposal processing finished. Processed: ${proposalsProcessed}, Secondary Votes Finalized: ${secondaryVotesFinalized}, Votes Collected: ${votesCollectedToMain}, Main Proposals Finalized Attempted/Confirmed: ${mainProposalsFinalized}`
        );
    } catch (error: any) {
        // Catch errors fetching proposal IDs etc.
        console.error("❌ Error during ended proposal processing:", error.message);
    }
}

// --- WebSocket Health Check & Reconnection ---
// (Keep setupWebSocketHealthCheck, reconnectMainChain, reconnectSecondaryChain functions as they are)
// ... existing health check and reconnection functions ...
function setupWebSocketHealthCheck(
    connections: {
        main: ContractConnections;
        secondary: Record<string, ContractConnections>;
    },
    options = {
        checkInterval: 60000,
        maxReconnectAttempts: 5,
        reconnectDelay: 5000,
    }
) {
    const reconnectAttempts: Record<string, number> = {};

    async function attemptReconnect(chainId: string, isMain: boolean) {
        const connection = isMain ? connections.main : connections.secondary[chainId];
        const maxAttempts = options.maxReconnectAttempts;
        const currentAttempts = reconnectAttempts[chainId] || 0;

        if (currentAttempts >= maxAttempts) {
            console.error(`❌ Max reconnection attempts reached for ${chainId}`);
            return;
        }

        reconnectAttempts[chainId] = currentAttempts + 1;

        try {
            if (isMain) {
                await reconnectMainChain(connections);
            } else {
                await reconnectSecondaryChain(connections, chainId);
            }
            reconnectAttempts[chainId] = 0;
        } catch (error) {
            console.error(`❌ Reconnection attempt ${currentAttempts + 1} failed for ${chainId}`);
            setTimeout(() => attemptReconnect(chainId, isMain), options.reconnectDelay);
        }
    }

    setInterval(() => {
        const mainWs = connections.main.wsInstance;
        if (
            !mainWs ||
            mainWs.readyState === WebSocket.CLOSED ||
            mainWs.readyState === WebSocket.CLOSING
        ) {
            console.log("🔄 Main chain WebSocket disconnected, attempting reconnection...");
            attemptReconnect("main", true);
        }
        for (const [chainId, connection] of Object.entries(connections.secondary)) {
            const ws = connection.wsInstance;
            if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
                console.log(
                    `🔄 ${chainId} chain WebSocket disconnected, attempting reconnection...`
                );
                attemptReconnect(chainId, false);
            }
        }
    }, options.checkInterval);

    process.on("uncaughtException", (error) => {
        console.error("Uncaught exception:", error);
        attemptReconnect("main", true);
        for (const chainId of Object.keys(connections.secondary)) {
            attemptReconnect(chainId, false);
        }
    });
}

async function reconnectMainChain(connections: {
    main: ContractConnections;
    secondary: Record<string, ContractConnections>;
}) {
    try {
        await connections.main.provider.destroy();
        const mainProvider = createWebSocketProvider(CONFIG.MAIN.WS_URL);
        const mainSigner = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, mainProvider);
        const mainContract = new ethers.Contract(
            CONFIG.MAIN.CONTRACT,
            MAIN_GOVERNANCE_ABI,
            mainSigner
        );

        connections.main = {
            provider: mainProvider,
            contract: mainContract,
            signer: mainSigner,
            wsInstance: mainProvider.websocket as WebSocket,
        };

        setupMainChainEventListeners(mainContract, connections.secondary);
        console.log("✅ Successfully reconnected to main chain");
    } catch (error) {
        throw new Error(`Failed to reconnect to main chain: ${error}`);
    }
}

async function reconnectSecondaryChain(
    connections: {
        main: ContractConnections;
        secondary: Record<string, ContractConnections>;
    },
    chainId: string
) {
    try {
        const chainConfig = CONFIG.SECONDARY_CHAINS.find((c) => c.CHAIN_ID === chainId);
        if (!chainConfig) throw new Error(`No config for chain ${chainId}`);
        await connections.secondary[chainId].provider.destroy();
        const provider = createWebSocketProvider(chainConfig.WS_URL);
        const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, provider);
        const contract = new ethers.Contract(
            chainConfig.CONTRACT,
            SECONDARY_GOVERNANCE_ABI,
            signer
        );

        connections.secondary[chainId] = {
            provider,
            contract,
            signer,
            wsInstance: provider.websocket as WebSocket,
        };

        setupSecondaryChainEventListeners(connections.main.contract, {
            [chainId]: connections.secondary[chainId],
        });

        console.log(`✅ Successfully reconnected to ${chainId} chain`);
    } catch (error) {
        throw new Error(`Failed to reconnect to ${chainId} chain: ${error}`);
    }
}

// --- Cache Handling ---
// (Keep loadProposalCache, saveProposalCache, markProposalAsFinalized functions as they are)
// ... existing cache functions ...
function loadProposalCache(): ProposalCache {
    try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE_PATH, "utf8"));
        }
    } catch (error) {
        console.error("Error loading proposal cache:", error);
    }
    return { finalized: [], lastUpdate: 0 };
}

function saveProposalCache(cache: ProposalCache) {
    try {
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
    } catch (error) {
        console.error("Error saving proposal cache:", error);
    }
}

function markProposalAsFinalized(proposalId: string, cache: ProposalCache) {
    cache.finalized.push({
        id: proposalId,
        timestamp: Math.floor(Date.now() / 1000),
    });
    cache.lastUpdate = Math.floor(Date.now() / 1000);
    saveProposalCache(cache);
}

// --- Task Scheduling ---
function scheduleRecurringTasks(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>,
    cache: ProposalCache // Pass cache
) {
    // Process proposals whose voting period has ended (runs frequently)
    const processInterval = 2 * 60 * 1000; // 2 minutes
    console.log(
        `Scheduling 'processEndedProposals' to run every ${processInterval / 1000 / 60} minutes.`
    );
    setInterval(async () => {
        console.log(
            `\n--- Running scheduled task: processEndedProposals @ ${new Date().toISOString()} ---`
        );
        await processEndedProposals(mainContract, secondaryConnections, cache);
        console.log(`--- Finished scheduled task: processEndedProposals ---`);
    }, processInterval);

    // Sync state for all proposals (runs less frequently)
    const syncInterval = 30 * 60 * 1000; // 30 minutes
    console.log(
        `Scheduling 'syncExistingProposals' to run every ${syncInterval / 1000 / 60} minutes.`
    );
    setInterval(async () => {
        console.log(
            `\n--- Running scheduled task: syncExistingProposals @ ${new Date().toISOString()} ---`
        );
        await syncExistingProposals(mainContract, secondaryConnections, cache);
        console.log(`--- Finished scheduled task: syncExistingProposals ---`);
    }, syncInterval);
}

// --- Main Execution ---
async function main() {
    console.log(`\n🔗 Starting Multi-Chain Governance Relayer @ ${new Date().toISOString()}`);
    let connections: {
        main: ContractConnections;
        secondary: Record<string, ContractConnections>;
    } | null = null;
    let cache: ProposalCache | null = null;

    try {
        // Load cache first
        cache = loadProposalCache();
        console.log(
            `💾 Proposal cache loaded. ${cache.finalized.length} proposals marked finalized.`
        );

        // Initialize connections
        connections = await initializeContracts();

        // Setup health checks (pass connections directly)
        setupWebSocketHealthCheck(connections); // Assuming this function handles potential nulls if needed

        // Setup event listeners (only if connections successful)
        setupMainChainEventListeners(connections.main.contract, connections.secondary);
        setupSecondaryChainEventListeners(connections.main.contract, connections.secondary);

        // Initial sync and processing (run once on startup)
        console.log("\n--- Running initial sync and processing tasks ---");
        await syncExistingProposals(connections.main.contract, connections.secondary, cache);
        await processEndedProposals(connections.main.contract, connections.secondary, cache);
        console.log("--- Initial tasks complete ---");

        // Schedule recurring tasks (pass connections and cache)
        scheduleRecurringTasks(connections.main.contract, connections.secondary, cache);

        console.log("\n✅ Relayer initialized successfully and running.");
        console.log("   - Listening for events on Main and Secondary chains.");
        console.log("   - Periodically syncing proposals and processing ended votes.");
    } catch (error: any) {
        console.error("\n❌ FATAL ERROR during relayer initialization:", error.message);
        // Perform cleanup if necessary (e.g., close WebSocket connections)
        if (connections) {
            try {
                connections.main.provider?.destroy();
            } catch {}
            for (const chainId in connections.secondary) {
                try {
                    connections.secondary[chainId].provider?.destroy();
                } catch {}
            }
        }
        process.exit(1); // Exit with error code
    }
}

// Graceful shutdown handler
process.on("SIGINT", async () => {
    console.log("\n👋 SIGINT received. Gracefully shutting down relayer...");
    // Add any cleanup logic here (e.g., closing connections, saving state)
    // Currently, WebSocket closing is handled by provider.destroy() or process exit
    console.log("   - Relayer shutdown complete.");
    process.exit(0); // Exit normally
});

process.on("SIGTERM", async () => {
    console.log("\n👋 SIGTERM received. Gracefully shutting down relayer...");
    console.log("   - Relayer shutdown complete.");
    process.exit(0);
});

// Start the main function
main().catch((error) => {
    // Catch unexpected errors during async execution after initialization
    console.error("\n❌ UNEXPECTED FATAL ERROR in main execution:", error);
    process.exit(1);
});
