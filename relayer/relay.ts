// import { ethers } from "ethers";
// import dotenv from "dotenv";
// import chalk from "chalk";
// import path from "path";
// import fs from "fs";
// import { contracts } from "../constants/contracts";

// dotenv.config();

// type networks = "BSC" | "ARB";

// /** ----------------------
//  *  1. Configuration
//  * --------------------- */
// const CONFIG = {
//     BSC: {
//         WS_URL: process.env.BSC_WS_URL || "",
//         CONTRACT: contracts.bscTestnet.governanceContract,
//         // JSON file tracking last processed block (optional if needed)
//         LAST_BLOCK_FILE: path.join(__dirname, "last_bsc_block.json"),
//     },
//     ARB: {
//         WS_URL: process.env.ARB_WS_URL || "",
//         CONTRACT: contracts.arbitrumTestnet.governanceContract,
//         // JSON file tracking last processed block (optional if needed)
//         LAST_BLOCK_FILE: path.join(__dirname, "last_arb_block.json"),
//     },
// };

// // The Governance contract ABI
// const GOVERNANCE_ABI = [
//     "function proposals(bytes32) view returns (bytes32, string, string, uint256, uint256, uint256, uint256, uint8, uint256, uint256, bool)",
//     "function mirrorProposal(bytes32, string, string, uint256, uint256)",
//     "function finalizeVoteTally(bytes32, uint256, uint256)",
//     "function executeProposal(bytes32)",
//     "event ProposalCreated(bytes32 indexed, string, string, uint256, uint256)",
//     "function getAllProposalIds() view returns (bytes32[])"
// ];

// /** -------------------------------------------------
//  *  2. Optional: Last Block Tracking (File I/O)
//  * ------------------------------------------------ */
// // If you want to avoid re-reading old blocks, you can store the last processed block in a file
// async function readLastBlock(network: networks, provider: ethers.Provider): Promise<number> {
//     try {
//         // Check if the file exists and is non-empty
//         if (!fs.existsSync(CONFIG[network].LAST_BLOCK_FILE) || fs.statSync(CONFIG[network].LAST_BLOCK_FILE).size === 0) {
//             console.warn(`⚠️ Block file for ${network} is missing or empty.`);

//             // Get the current block number and return (currentBlock - 1000)
//             const currentBlock = await provider.getBlockNumber();
//             const safeStartBlock = Math.max(currentBlock - 1000, 0);
//             console.warn(`⏩ Defaulting to block ${safeStartBlock} (currentBlock - 1000).`);
//             return safeStartBlock;
//         }

//         const data = JSON.parse(fs.readFileSync(CONFIG[network].LAST_BLOCK_FILE, "utf8"));
//         return data.block ?? 0;
//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//         console.warn(`⚠️ Could not read or parse block file for ${network}: ${errorMessage}`);

//         // On error, return currentBlock - 1000
//         const currentBlock = await provider.getBlockNumber();
//         const safeStartBlock = Math.max(currentBlock - 1000, 0);
//         console.warn(`⏩ Defaulting to block ${safeStartBlock} due to read error.`);
//         return safeStartBlock;
//     }
// }


// function writeLastBlock(network: networks, block: number) {
//     fs.writeFileSync(CONFIG[network].LAST_BLOCK_FILE, JSON.stringify({ block }), "utf8");
// }

// /** -------------------------------------------------
//  *  3. Reconnecting WebSocket Providers
//  * ------------------------------------------------ */
// function createReconnectingProvider(wsUrl: string): ethers.WebSocketProvider {
//     // Create WebSocket with custom reconnect logic
//     let ws = createWebSocket(wsUrl);

//     ws.onclose = (event) => {
//         console.warn(
//             `⚠️ WebSocket closed (code: ${event.code}, reason: ${event.reason}). Reconnecting...`
//         );
//         setTimeout(() => {
//             ws = createWebSocket(wsUrl);
//         }, 5000);
//     };

//     ws.onerror = (error) => {
//         console.error("WebSocket error:", error);
//     };

//     // Use ethers.js provider with the custom WebSocket
//     return new ethers.WebSocketProvider(ws);
// }

// function createWebSocket(wsUrl: string): WebSocket {
//     return new WebSocket(wsUrl);
// }

// /** -------------------------------------------------
//  *  4. Initialization of Contracts
//  * ------------------------------------------------ */
// async function initializeContracts() {
//     const bscProvider = createReconnectingProvider(CONFIG.BSC.WS_URL);
//     const arbProvider = createReconnectingProvider(CONFIG.ARB.WS_URL);

//     // The same private key can sign transactions on both providers
//     const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY || "");

//     // Connect the signer to each chain's provider
//     const bscSigner = signer.connect(bscProvider);
//     const arbSigner = signer.connect(arbProvider);

//     // Create the contract instances with the connected signers
//     const bscContract = new ethers.Contract(CONFIG.BSC.CONTRACT, GOVERNANCE_ABI, bscSigner);

//     const arbContract = new ethers.Contract(CONFIG.ARB.CONTRACT, GOVERNANCE_ABI, arbSigner);

//     return {
//         bscProvider,
//         arbProvider,
//         bscContract,
//         arbContract,
//     };
// }

// /** -------------------------------------------------
//  *  5. Utility: Get a proposal from a contract
//  * ------------------------------------------------ */
// interface RawProposal {
//     // The shape matches the `proposals(uint256)` return from the ABI
//     0: bigint; // id
//     1: string; // title
//     2: string; // description
//     3: bigint; // yesVotes
//     4: bigint; // noVotes
//     5: bigint; // startTime
//     6: bigint; // endTime
//     7: number; // status
//     8: bigint; // finalYesVotes
//     9: bigint; // finalNoVotes
//     10: boolean; // voteTallyFinalized
// }

// async function getProposal(contract: ethers.Contract, proposalId: string): Promise<RawProposal> {
//     const proposal = (await contract.proposals(proposalId)) as RawProposal;
//     return proposal;
// }

// async function getAllProposalIds(contract: ethers.Contract): Promise<string[]> {
//     try {
//         return await contract.getAllProposalIds();
//     } catch (error) {
//         console.error(`❌ Error fetching proposal IDs:`, error);
//         return [];
//     }
// }


// /** -------------------------------------------------
//  *  6. Syncing Proposals on Startup
//  * ------------------------------------------------ */
// async function syncProposals(
//     sourceContract: ethers.Contract,
//     targetContract: ethers.Contract,
//     targetChain: networks
// ) {
//     console.log(`🔄 Starting proposal sync from source to ${targetChain}`);

//     // Fetch all proposal IDs from the source contract
//     const proposalIds = await getAllProposalIds(sourceContract);
//     console.log(`📄 Found ${proposalIds.length} proposals on source chain`);

//     for (const proposalId of proposalIds) {
//         try {
//             // Check if the proposal exists on the target chain
//             const targetProposal = await targetContract.proposals(proposalId);

//             // If the proposal doesn't exist (startTime = 0), relay it
//             if (targetProposal[5] === 0n) {
//                 console.log(chalk.yellow(`🚀 Relaying missing proposal ${proposalId} to ${targetChain}`));
//                 await relayProposal(sourceContract, targetContract, proposalId, targetChain);
//             } else {
//                 console.log(chalk.green(`✅ Proposal ${proposalId} already synced on ${targetChain}`));
//             }
//         } catch (error) {
//             console.error(`❌ Error syncing proposal ${proposalId}:`, error);
//         }
//     }

//     console.log(`🏁 Sync complete for ${targetChain}`);
// }




// /** -------------------------------------------------
//  *  7. Relaying a Single Proposal
//  * ------------------------------------------------ */
// async function relayProposal(
//     sourceContract: ethers.Contract,
//     targetContract: ethers.Contract,
//     proposalId: string,
//     targetChain: networks
// ) {
//     try {
//         const sourceProposal = await getProposal(sourceContract, proposalId);
//         const sourceDuration = sourceProposal[6] - sourceProposal[5];

//         // Get the latest block timestamp on the target chain
//         const currentBlock = await targetContract.runner?.provider?.getBlock("latest");
//         if (!currentBlock) throw new Error("Failed to get target chain's latest block");

//         const newStart = BigInt(currentBlock.timestamp);
//         const newEnd = newStart + sourceDuration;

//         console.log(`🚀 Relaying proposal ${proposalId} to ${targetChain}`);
//         const tx = await targetContract.mirrorProposal(
//             proposalId,
//             sourceProposal[1],  // title
//             sourceProposal[2],  // description
//             newStart,
//             newEnd
//         );
//         await tx.wait();

//         console.log(chalk.green(`✅ Proposal ${proposalId} relayed successfully to ${targetChain}`));
//     } catch (error) {
//         console.error(`❌ Error relaying proposal ${proposalId}:`, error);
//     }
// }



// /** -------------------------------------------------
//  *  8. Listening for New Proposals (Event-based)
//  * ------------------------------------------------ */
// function listenForProposals(
//     sourceName: networks,
//     sourceContract: ethers.Contract,
//     targetName: networks,
//     targetContract: ethers.Contract
// ) {
//     sourceContract.on("ProposalCreated", async (id: string, title, desc, start, end, event) => {
//         try {
//             // Proposal ID is now bytes32 (string in ethers.js)
//             console.log(chalk.blue(`📢 New proposal on ${sourceName}: ID ${id} - ${title}`));

//             // Relay it to the target chain
//             await relayProposal(sourceContract, targetContract, id, targetName);
//         } catch (error) {
//             console.error("❌ Error handling new proposal event:", error);
//         }
//     });
// }

// /** -------------------------------------------------
//  *  9. Periodic Vote Finalization & Execution
//  * ------------------------------------------------ */
// async function processCompletedProposals(
//     bscContract: ethers.Contract,
//     arbContract: ethers.Contract
// ) {
//     const currentTime = BigInt(Math.floor(Date.now() / 1000));
//     const proposalIds = await getAllProposalIds(bscContract); // Fetch proposal IDs

//     for (const proposalId of proposalIds) {
//         try {
//             const [bscData, arbData] = await Promise.all([
//                 getProposal(bscContract, proposalId),
//                 getProposal(arbContract, proposalId),
//             ]);

//             console.log(`Processing proposal ${proposalId}:`);
//             console.log(`- BSC Status: ${bscData[10] ? "Finalized" : "Pending"}`);
//             console.log(`- ARB Status: ${arbData[10] ? "Finalized" : "Pending"}`);

//             // Skip if voting period hasn't ended on either chain
//             if (currentTime < bscData[6]) {
//                 console.log(`Voting period ongoing for ${proposalId} on BSC`);
//                 continue;
//             }
//             if (currentTime < arbData[6]) {
//                 console.log(`Voting period ongoing for ${proposalId} on ARB`);
//                 continue;
//             }

//             const totalYes = bscData[3] + arbData[3];
//             const totalNo = bscData[4] + arbData[4];

//             // Finalize votes if needed
//             if (!bscData[10]) {
//                 const tx = await bscContract.finalizeVoteTally(proposalId, totalYes, totalNo);
//                 await tx.wait();
//                 console.log(chalk.green(`✅ Finalized votes for ${proposalId} on BSC`));
//             }
//             if (!arbData[10]) {
//                 const tx = await arbContract.finalizeVoteTally(proposalId, totalYes, totalNo);
//                 await tx.wait();
//                 console.log(chalk.green(`✅ Finalized votes for ${proposalId} on ARB`));
//             }

//             // Execute proposals if eligible and not already executed
//             if (bscData[10] && bscData[7] === 0) {
//                 await maybeExecuteProposal(proposalId, bscContract, bscData);
//             }
//             if (arbData[10] && arbData[7] === 0) {
//                 await maybeExecuteProposal(proposalId, arbContract, arbData);
//             }
//         } catch (error) {
//             console.error(`❌ Error processing proposal ${proposalId}:`, error);
//         }
//     }
// }

// async function maybeExecuteProposal(
//     proposalId: string,
//     contract: ethers.Contract,
//     data: RawProposal
// ) {
//     // status = 0 => Pending in your enum
//     // If finalYesVotes > finalNoVotes => status may become 1 => Accepted
//     // We only attempt to execute if status is 0 (Pending) to let the contract set the final status
//     if (data[7] === 0 && data[10] === true) {
//         const tx = await contract.executeProposal(proposalId);
//         await tx.wait();
//         console.log(chalk.green(`🚀 Executed proposal ${proposalId} on ${contract.address}`));
//     }
// }

// /** -------------------------------------------------
//  *  10. Main Entrypoint
//  * ------------------------------------------------ */
// async function main() {
//     console.log(chalk.blue("🚀 Starting Governance Relayer (Ethers v6)"));

//     const { bscContract, arbContract } = await initializeContracts();

//     // 1) Sync all proposals on startup
//     console.log(chalk.blue("🔄 Syncing proposals on startup..."));
//     await Promise.all([
//         syncProposals(bscContract, arbContract, "ARB"),
//         syncProposals(arbContract, bscContract, "BSC"),
//     ]);

//     // 2) Listen for new proposals on both chains
//     listenForProposals("BSC", bscContract, "ARB", arbContract);
//     listenForProposals("ARB", arbContract, "BSC", bscContract);

//     // 3) Periodically process completed proposals
//     setInterval(() => processCompletedProposals(bscContract, arbContract), 60_000);

//     console.log(chalk.green("🏁 Relayer is operational!"));
// }



// // Start the relayer
// main().catch((err) => {
//     console.error("💥 Fatal error in relayer:", err);
//     process.exit(1);
// });
