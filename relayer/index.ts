import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// Types for type safety
interface ChainConfig {
    CHAIN_ID: string;
    RPC_URL: string;
    WS_URL: string;
    CONTRACT: string;
    LAST_BLOCK_FILE: string;
}

interface ContractConnections {
    provider: ethers.WebSocketProvider;
    contract: ethers.Contract;
    signer: ethers.Wallet;
}

/**
 * Configuration settings for main and secondary chains
 */
const CONFIG = {
    // Main chain configuration
    MAIN: {
        CHAIN_ID: "main",
        RPC_URL: process.env.BSC_RPC || "",
        WS_URL: process.env.BSC_WS_URL || "",
        CONTRACT: "0xa6bA1c44442bf0d579B36201004dD5174061Db31",
        LAST_BLOCK_FILE: path.join(__dirname, "last_main_block.txt"),
    },
    // Secondary chains configuration
    SECONDARY_CHAINS: [
        {
            CHAIN_ID: "arb",
            RPC_URL: process.env.ARB_RPC || "",
            WS_URL: process.env.ARB_WS_URL || "",
            CONTRACT: "0x3897EC8be98ccDAc707c8D4B9f8C953eDC237f67",
            LAST_BLOCK_FILE: path.join(__dirname, "last_arb_block.txt"),
        },
        // Add more secondary chains as needed
    ],
};

// ABIs
const MAIN_GOVERNANCE_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/main.json"), "utf8")
);

const SECONDARY_GOVERNANCE_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/secondary.json"), "utf8")
);

/**
 * Read the last processed block from file
 */
async function readLastBlock(configEntry: ChainConfig, provider: ethers.Provider): Promise<number> {
    try {
        if (!fs.existsSync(configEntry.LAST_BLOCK_FILE)) {
            const currentBlock = await provider.getBlockNumber();
            const safeStartBlock = Math.max(currentBlock - 100, 0);
            return safeStartBlock;
        }

        const blockNumber = parseInt(fs.readFileSync(configEntry.LAST_BLOCK_FILE, "utf8"), 10);
        return isNaN(blockNumber) ? 0 : blockNumber;
    } catch (error) {
        console.warn(`⚠️ Error reading block file for ${configEntry.CHAIN_ID}:`, error);
        const currentBlock = await provider.getBlockNumber();
        return Math.max(currentBlock - 100, 0);
    }
}

/**
 * Write the last processed block to file
 */
function writeLastBlock(configEntry: ChainConfig, block: number): void {
    fs.writeFileSync(configEntry.LAST_BLOCK_FILE, block.toString(), "utf8");
}

/**
 * Initialize providers and contracts with websocket connections
 */
async function initializeContracts(): Promise<{
    main: ContractConnections;
    secondary: Record<string, ContractConnections>;
}> {
    // Check if the private key is set
    if (!process.env.RELAYER_PVT_KEY) {
        throw new Error("RELAYER_PVT_KEY is not set in environment variables");
    }

    // Initialize main chain with websocket provider
    const mainProvider = new ethers.WebSocketProvider(CONFIG.MAIN.WS_URL);
    const mainSigner = new ethers.Wallet(process.env.RELAYER_PVT_KEY, mainProvider);
    const mainContract = new ethers.Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

    // Initialize secondary chains
    const secondaryConnections: Record<string, ContractConnections> = {};

    for (const chain of CONFIG.SECONDARY_CHAINS) {
        try {
            const provider = new ethers.WebSocketProvider(chain.WS_URL);
            const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY, provider);
            const contract = new ethers.Contract(chain.CONTRACT, SECONDARY_GOVERNANCE_ABI, signer);

            secondaryConnections[chain.CHAIN_ID] = {
                provider,
                contract,
                signer,
            };

            console.log(`🔌 Connected to ${chain.CHAIN_ID} chain`);
        } catch (error) {
            console.error(`❌ Failed to connect to ${chain.CHAIN_ID} chain:`, error);
        }
    }

    return {
        main: {
            provider: mainProvider,
            contract: mainContract,
            signer: mainSigner,
        },
        secondary: secondaryConnections,
    };
}

/**
 * Set up event listeners for main chain events
 */
function setupMainChainEventListeners(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🎧 Setting up event listeners for main chain");

    // Listen for proposal creation events
    mainContract.on("ProposalCreated", async (id, title, endTime, event) => {
        console.log(`🆕 New proposal created on main chain: ${id} - ${title}`);

        try {
            // Get the full proposal details
            const proposal = await mainContract.proposals(id);

            // Sync the proposal to all secondary chains
            for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                try {
                    console.log(`🔄 Mirroring proposal ${id} to ${chainId}`);

                    // Check if proposal already exists on secondary chain
                    const secondaryProposal = await contract.proposals(id);

                    if (secondaryProposal[5] === 0n) {
                        // startTime = 0 means it doesn't exist
                        const tx = await contract.mirrorProposal(
                            id,
                            proposal[1], // title
                            proposal[2], // description
                            proposal[5], // startTime
                            proposal[6], // endTime
                            proposal[7] // snapshotBlock
                        );

                        await tx.wait();
                        console.log(`✅ Proposal ${id} mirrored to ${chainId}`);
                    } else {
                        console.log(`ℹ️ Proposal ${id} already exists on ${chainId}`);
                    }
                } catch (error) {
                    console.error(`❌ Error mirroring proposal to ${chainId}:`, error);
                }
            }
        } catch (error) {
            console.error(`❌ Error processing proposal created event:`, error);
        }
    });

    // Listen for vote tally finalization events
    mainContract.on("VoteTallyFinalized", async (id, totalYesVotes, totalNoVotes, event) => {
        console.log(`🔢 Vote tally finalized for proposal ${id}`);

        try {
            // Execute the proposal on the main chain
            const tx = await mainContract.executeProposal(id);
            await tx.wait();
            console.log(`✅ Executed proposal ${id} on main chain`);
        } catch (error) {
            console.error(`❌ Error executing proposal ${id}:`, error);
        }
    });

    // Listen for proposal execution events
    mainContract.on("ProposalExecuted", async (id, status, event) => {
        console.log(`🚀 Proposal ${id} executed on main chain with status: ${status}`);

        // Update the status on all secondary chains
        for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
            try {
                const tx = await contract.updateProposalStatus(id, status);
                await tx.wait();
                console.log(`✅ Updated proposal ${id} status to ${status} on ${chainId}`);
            } catch (error) {
                console.error(`❌ Error updating proposal status on ${chainId}:`, error);
            }
        }
    });
}

/**
 * Set up event listeners for secondary chain events
 */
function setupSecondaryChainEventListeners(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🎧 Setting up event listeners for secondary chains");

    for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
        // Listen for vote tally events
        contract.on("VotesTallied", async (proposalId, yesVotes, noVotes, event) => {
            console.log(`🗳️ Votes tallied for proposal ${proposalId} on ${chainId}`);

            try {
                // Check if votes have already been collected
                const secondaryVotes = await mainContract.secondaryChainVotes(proposalId, chainId);

                if (!secondaryVotes[2]) {
                    // if not collected
                    const tx = await mainContract.collectSecondaryChainVotes(
                        proposalId,
                        chainId,
                        yesVotes,
                        noVotes
                    );

                    await tx.wait();
                    console.log(`✅ Collected votes from ${chainId} for proposal ${proposalId}`);

                    // Check if all secondary chains have reported their votes
                    let allVotesCollected = true;
                    const registeredChains = await mainContract.getRegisteredChains();

                    for (const registeredChain of registeredChains) {
                        const votes = await mainContract.secondaryChainVotes(
                            proposalId,
                            registeredChain
                        );
                        if (!votes[2]) {
                            // if not collected
                            allVotesCollected = false;
                            break;
                        }
                    }

                    // If all votes collected, finalize the tally
                    if (allVotesCollected) {
                        const proposal = await mainContract.proposals(proposalId);

                        // Check if the voting period has ended
                        const currentTime = Math.floor(Date.now() / 1000);
                        if (Number(proposal[6]) <= currentTime && !proposal[11]) {
                            const finalizeTx = await mainContract.finalizeVoteTally(proposalId);
                            await finalizeTx.wait();
                            console.log(`✅ Finalized vote tally for proposal ${proposalId}`);
                        }
                    }
                } else {
                    console.log(
                        `ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`
                    );
                }
            } catch (error) {
                console.error(`❌ Error collecting votes from ${chainId}:`, error);
            }
        });
    }
}

/**
 * Sync all existing proposals from main chain to secondary chains
 */
async function syncExistingProposals(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🔄 Syncing existing proposals from main chain to secondary chains");

    try {
        // Get all proposal IDs from main chain
        const proposalIds = await mainContract.getAllProposalIds();
        console.log(`📄 Found ${proposalIds.length} proposals on main chain`);

        for (const proposalId of proposalIds) {
            try {
                // Get proposal details from main chain
                const mainProposal = await mainContract.proposals(proposalId);

                // Mirror to all secondary chains if not already mirrored
                for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                    try {
                        // Check if proposal exists on secondary chain
                        const secondaryProposal = await contract.proposals(proposalId);

                        if (secondaryProposal[5] === 0n) {
                            // startTime = 0 means it doesn't exist
                            console.log(
                                `🔄 Mirroring existing proposal ${proposalId} to ${chainId}`
                            );

                            const tx = await contract.mirrorProposal(
                                proposalId,
                                mainProposal[1], // title
                                mainProposal[2], // description
                                mainProposal[5], // startTime
                                mainProposal[6], // endTime
                                mainProposal[7] // snapshotBlock
                            );

                            await tx.wait();
                            console.log(`✅ Proposal ${proposalId} mirrored to ${chainId}`);
                        } else {
                            console.log(`✓ Proposal ${proposalId} already exists on ${chainId}`);

                            // Update status if proposal is executed on main chain but not on secondary
                            if (mainProposal[8] !== 0 && secondaryProposal[8] === 0) {
                                const tx = await contract.updateProposalStatus(
                                    proposalId,
                                    mainProposal[8]
                                );
                                await tx.wait();
                                console.log(
                                    `✅ Updated proposal ${proposalId} status on ${chainId}`
                                );
                            }
                        }
                    } catch (error) {
                        console.error(
                            `❌ Error processing proposal ${proposalId} for ${chainId}:`,
                            error
                        );
                    }
                }
            } catch (error) {
                console.error(`❌ Error processing proposal ${proposalId}:`, error);
            }
        }
    } catch (error) {
        console.error("❌ Error syncing existing proposals:", error);
    }
}

/**
 * Process proposals with ended voting periods
 */
async function processEndedProposals(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🔄 Processing proposals with ended voting periods");

    try {
        // Get all proposal IDs from main chain
        const proposalIds = await mainContract.getAllProposalIds();
        const currentTime = Math.floor(Date.now() / 1000);

        for (const proposalId of proposalIds) {
            try {
                const mainProposal = await mainContract.proposals(proposalId);

                // Skip if voting period hasn't ended
                if (Number(mainProposal[6]) > currentTime) {
                    continue;
                }

                // Skip if already executed
                if (mainProposal[8] !== 0) {
                    continue;
                }

                // Collect votes from secondary chains if not already collected
                let allVotesCollected = true;
                const registeredChains = await mainContract.getRegisteredChains();

                for (const chainId of registeredChains) {
                    if (!secondaryConnections[chainId]) continue;

                    const votes = await mainContract.secondaryChainVotes(proposalId, chainId);

                    if (!votes[2]) {
                        // if not collected
                        allVotesCollected = false;

                        // Tally votes on secondary chain
                        try {
                            const { contract } = secondaryConnections[chainId];
                            const secondaryProposal = await contract.proposals(proposalId);

                            if (!secondaryProposal[9]) {
                                // if not tallied
                                console.log(`🗳️ Tallying votes for ${proposalId} on ${chainId}`);
                                const tx = await contract.tallyVotes(proposalId);
                                await tx.wait();
                                console.log(`✅ Votes tallied for ${proposalId} on ${chainId}`);
                            }

                            // Collect votes to main chain
                            const collectTx = await mainContract.collectSecondaryChainVotes(
                                proposalId,
                                chainId,
                                secondaryProposal[3], // yesVotes
                                secondaryProposal[4] // noVotes
                            );

                            await collectTx.wait();
                            console.log(
                                `✅ Collected votes from ${chainId} for proposal ${proposalId}`
                            );
                        } catch (error) {
                            console.error(
                                `❌ Error collecting votes from ${chainId} for ${proposalId}:`,
                                error
                            );
                        }
                    }
                }

                // Finalize vote tally if all votes collected and not already finalized
                if (allVotesCollected && !mainProposal[11]) {
                    try {
                        console.log(`🔢 Finalizing vote tally for proposal ${proposalId}`);
                        const finalizeTx = await mainContract.finalizeVoteTally(proposalId);
                        await finalizeTx.wait();
                        console.log(`✅ Finalized vote tally for proposal ${proposalId}`);

                        // Execute proposal
                        const executeTx = await mainContract.executeProposal(proposalId);
                        await executeTx.wait();
                        console.log(`✅ Executed proposal ${proposalId}`);
                    } catch (error) {
                        console.error(
                            `❌ Error finalizing/executing proposal ${proposalId}:`,
                            error
                        );
                    }
                }
            } catch (error) {
                console.error(`❌ Error processing proposal ${proposalId}:`, error);
            }
        }
    } catch (error) {
        console.error("❌ Error processing ended proposals:", error);
    }
}

/**
 * Create WebSocket health check and reconnect mechanism
 */
function setupWebSocketHealthCheck(
    connections: {
        main: ContractConnections;
        secondary: Record<string, ContractConnections>;
    },
    reconnectInterval: number = 30000
) {
    // Health check for main chain
    setInterval(() => {
        if (connections.main.provider.websocket?.readyState === 3) {
            // CLOSED
            console.log("🔄 Main chain WebSocket disconnected, reconnecting...");
            reconnectMainChain(connections);
        }
    }, reconnectInterval);

    // Health check for secondary chains
    setInterval(() => {
        for (const [chainId, connection] of Object.entries(connections.secondary)) {
            if (connection.provider.websocket?.readyState === 3) {
                // CLOSED
                console.log(`🔄 ${chainId} chain WebSocket disconnected, reconnecting...`);
                reconnectSecondaryChain(connections, chainId);
            }
        }
    }, reconnectInterval);
}

/**
 * Reconnect to main chain
 */
async function reconnectMainChain(connections: {
    main: ContractConnections;
    secondary: Record<string, ContractConnections>;
}) {
    try {
        // Close existing connection
        await connections.main.provider.destroy();

        // Create new connection
        const mainProvider = new ethers.WebSocketProvider(CONFIG.MAIN.WS_URL);
        const mainSigner = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, mainProvider);
        const mainContract = new ethers.Contract(
            CONFIG.MAIN.CONTRACT,
            MAIN_GOVERNANCE_ABI,
            mainSigner
        );

        // Update connections
        connections.main = {
            provider: mainProvider,
            contract: mainContract,
            signer: mainSigner,
        };

        // Set up event listeners again
        setupMainChainEventListeners(mainContract, connections.secondary);

        console.log("✅ Successfully reconnected to main chain");
    } catch (error) {
        console.error("❌ Failed to reconnect to main chain:", error);
    }
}

/**
 * Reconnect to secondary chain
 */
async function reconnectSecondaryChain(
    connections: {
        main: ContractConnections;
        secondary: Record<string, ContractConnections>;
    },
    chainId: string
) {
    try {
        const chainConfig = CONFIG.SECONDARY_CHAINS.find((c) => c.CHAIN_ID === chainId);

        if (!chainConfig) {
            console.error(`❌ Cannot find configuration for chain ${chainId}`);
            return;
        }

        // Close existing connection
        await connections.secondary[chainId].provider.destroy();

        // Create new connection
        const provider = new ethers.WebSocketProvider(chainConfig.WS_URL);
        const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, provider);
        const contract = new ethers.Contract(
            chainConfig.CONTRACT,
            SECONDARY_GOVERNANCE_ABI,
            signer
        );

        // Update connections
        connections.secondary[chainId] = {
            provider,
            contract,
            signer,
        };

        // Set up event listeners again
        setupSecondaryChainEventListeners(connections.main.contract, {
            [chainId]: connections.secondary[chainId],
        });

        console.log(`✅ Successfully reconnected to ${chainId} chain`);
    } catch (error) {
        console.error(`❌ Failed to reconnect to ${chainId} chain:`, error);
    }
}

/**
 * Run scheduled tasks
 */
function scheduleRecurringTasks(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    // Process ended proposals every 5 minutes
    setInterval(async () => {
        await processEndedProposals(mainContract, secondaryConnections);
    }, 5 * 60 * 1000);

    // Sync existing proposals every hour
    setInterval(async () => {
        await syncExistingProposals(mainContract, secondaryConnections);
    }, 60 * 60 * 1000);
}

/**
 * Main function to run the relayer
 */
async function main() {
    console.log("🔗 Starting Multi-Chain Governance Relayer with WebSockets");

    try {
        // Initialize contracts and providers
        const connections = await initializeContracts();

        // Set up WebSocket health check
        setupWebSocketHealthCheck(connections);

        // Set up event listeners
        setupMainChainEventListeners(connections.main.contract, connections.secondary);
        setupSecondaryChainEventListeners(connections.main.contract, connections.secondary);

        // Perform initial sync of existing proposals
        await syncExistingProposals(connections.main.contract, connections.secondary);

        // Process any proposals with ended voting periods
        await processEndedProposals(connections.main.contract, connections.secondary);

        // Schedule recurring tasks
        scheduleRecurringTasks(connections.main.contract, connections.secondary);

        console.log("✅ Relayer initialized and running");
    } catch (error) {
        console.error("❌ Error initializing relayer:", error);
        process.exit(1);
    }
}

// Handle process termination
process.on("SIGINT", async () => {
    console.log("👋 Gracefully shutting down...");
    process.exit(0);
});

// Run the main function
main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
});
