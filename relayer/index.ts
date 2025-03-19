import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

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
        CONTRACT: "0x4F90cb1474bF846682B267e62cEA52505477B378",
        LAST_BLOCK_FILE: path.join(__dirname, "last_main_block.txt"),
    },
    // Secondary chains configuration
    SECONDARY_CHAINS: [
        {
            CHAIN_ID: "arb",
            RPC_URL: process.env.ARB_RPC || "",
            WS_URL: process.env.ARB_WS_URL || "",
            CONTRACT: "0x82ACdE34e54B408E808a8f625648ED4eCe7A745e",
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

            secondaryConnections[chain.CHAIN_ID] = { provider, contract, signer };
            console.log(`🔌 Connected to ${chain.CHAIN_ID} chain`);
        } catch (error) {
            console.error(`❌ Failed to connect to ${chain.CHAIN_ID} chain:`, error);
        }
    }

    return {
        main: { provider: mainProvider, contract: mainContract, signer: mainSigner },
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
            const proposal = await mainContract.getProposalDetails(id);

            // Sync the proposal to all secondary chains
            for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                try {
                    console.log(`🔄 Mirroring proposal ${id} to ${chainId}`);

                    // Try-catch to handle potential errors when checking if proposal already exists
                    try {
                        const secondaryProposal = await contract.getProposalDetails(id);
                        if (secondaryProposal.startTime > 0) {
                            console.log(`ℹ️ Proposal ${id} already exists on ${chainId}`);
                            continue;
                        }
                    } catch (err) {
                        // If error, proposal likely doesn't exist, proceed with mirroring
                    }

                    const tx = await contract.mirrorProposal(
                        id,
                        proposal.title,
                        proposal.description,
                        proposal.startTime,
                        proposal.endTime
                    );

                    await tx.wait();
                    console.log(`✅ Proposal ${id} mirrored to ${chainId}`);
                } catch (error) {
                    console.error(`❌ Error mirroring proposal to ${chainId}:`, error);
                }
            }
        } catch (error) {
            console.error(`❌ Error processing proposal created event:`, error);
        }
    });

    mainContract.on("ProposalExecuted", async (id, status, event) => {
        console.log(`🚀 Proposal ${id} executed on main chain with status: ${status}`);

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
            console.log(
                `🗳️ Votes tallied for proposal ${proposalId} on ${chainId}: Yes=${yesVotes}, No=${noVotes}`
            );

            try {
                // Check if votes have already been collected
                try {
                    const secondaryVotes = await mainContract.secondaryChainVotes(
                        proposalId,
                        chainId
                    );

                    // If votes already collected, skip
                    if (secondaryVotes.collected) {
                        console.log(
                            `ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`
                        );
                        return;
                    }
                } catch (err) {
                    // If error, votes likely not collected yet
                }

                // Collect votes to main chain
                const tx = await mainContract.collectSecondaryChainVotes(
                    proposalId,
                    chainId,
                    yesVotes,
                    noVotes
                );

                await tx.wait();
                console.log(`✅ Collected votes from ${chainId} for proposal ${proposalId}`);

                // Check if we can finalize the proposal
                try {
                    const proposal = await mainContract.getProposalDetails(proposalId);

                    // Check if voting period has ended and vote not yet finalized
                    const currentTime = Math.floor(Date.now() / 1000);
                    const cooldownEndTime = Number(proposal.endTime) + 3 * 60; // 3 minutes cooldown period

                    if (currentTime >= cooldownEndTime && !proposal.voteTallyFinalized) {
                        console.log(
                            `⏱️ Cooldown period ended for proposal ${proposalId}, finalizing votes`
                        );

                        const finalizeTx = await mainContract.finalizeProposalVotes(proposalId);
                        await finalizeTx.wait();
                        console.log(`✅ Finalized vote tally for proposal ${proposalId}`);
                    } else if (currentTime < cooldownEndTime) {
                        console.log(
                            `⏳ Waiting for cooldown period to end for proposal ${proposalId}. Time remaining: ${
                                cooldownEndTime - currentTime
                            } seconds`
                        );
                    }
                } catch (error) {
                    console.error(`❌ Error checking proposal finalization status: ${error}`);
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
        const proposalIds = await mainContract.getProposalIds();
        console.log(`📄 Found ${proposalIds.length} proposals on main chain`);

        for (const proposalId of proposalIds) {
            try {
                // Get proposal details from main chain
                const mainProposal = await mainContract.getProposalDetails(proposalId);

                // Mirror to all secondary chains if not already mirrored
                for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                    try {
                        let secondaryProposal;
                        let proposalExists = true;

                        try {
                            secondaryProposal = await contract.getProposalDetails(proposalId);
                        } catch (err) {
                            proposalExists = false;
                        }

                        if (!proposalExists || secondaryProposal.startTime === 0n) {
                            console.log(
                                `🔄 Mirroring existing proposal ${proposalId} to ${chainId}`
                            );

                            const tx = await contract.mirrorProposal(
                                proposalId,
                                mainProposal.title,
                                mainProposal.description,
                                mainProposal.startTime,
                                mainProposal.endTime
                            );

                            await tx.wait();
                            console.log(`✅ Proposal ${proposalId} mirrored to ${chainId}`);
                        } else {
                            console.log(`✓ Proposal ${proposalId} already exists on ${chainId}`);

                            // Update status if proposal has a different status on main vs secondary
                            if (
                                mainProposal.status !== secondaryProposal.status &&
                                mainProposal.status !== 0
                            ) {
                                const tx = await contract.updateProposalStatus(
                                    proposalId,
                                    mainProposal.status
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
        const proposalIds = await mainContract.getProposalIds();
        const currentTime = Math.floor(Date.now() / 1000);

        for (const proposalId of proposalIds) {
            try {
                const mainProposal = await mainContract.getProposalDetails(proposalId);

                // Skip if voting period hasn't ended
                if (Number(mainProposal.endTime) > currentTime) {
                    continue;
                }

                // Skip if already finalized
                if (mainProposal.voteTallyFinalized) {
                    continue;
                }

                // Process secondary chain votes if not already finalized
                const registeredChains = await mainContract.getRegisteredChains();

                for (const chainId of registeredChains) {
                    if (!secondaryConnections[chainId]) continue;

                    try {
                        const { contract } = secondaryConnections[chainId];
                        let secondaryVotes;

                        try {
                            secondaryVotes = await mainContract.secondaryChainVotes(
                                proposalId,
                                chainId
                            );

                            if (secondaryVotes.collected) {
                                continue; // Votes already collected
                            }
                        } catch (err) {
                            // If error, votes likely not collected yet
                        }

                        // Check if votes have been tallied on secondary chain
                        const secondaryProposal = await contract.getProposalDetails(proposalId);

                        if (
                            !secondaryProposal.voteTallied &&
                            Number(secondaryProposal.endTime) <= currentTime
                        ) {
                            console.log(`🗳️ Finalizing votes for ${proposalId} on ${chainId}`);
                            const tx = await contract.finalizeVotes(proposalId);
                            await tx.wait();
                            console.log(`✅ Votes finalized for ${proposalId} on ${chainId}`);

                            // Get updated proposal with vote counts
                            const updatedProposal = await contract.getProposalDetails(proposalId);

                            // Collect votes to main chain
                            const collectTx = await mainContract.collectSecondaryChainVotes(
                                proposalId,
                                chainId,
                                updatedProposal.yesVotes,
                                updatedProposal.noVotes
                            );

                            await collectTx.wait();
                            console.log(
                                `✅ Collected votes from ${chainId} for proposal ${proposalId}`
                            );
                        }
                    } catch (error) {
                        console.error(
                            `❌ Error processing votes from ${chainId} for ${proposalId}:`,
                            error
                        );
                    }
                }

                // Check if cooldown period has passed (3 minutes after voting ends)
                const cooldownEndTime = Number(mainProposal.endTime) + 3 * 60;

                if (currentTime >= cooldownEndTime && !mainProposal.voteTallyFinalized) {
                    try {
                        console.log(`🔢 Finalizing vote tally for proposal ${proposalId}`);
                        const finalizeTx = await mainContract.finalizeProposalVotes(proposalId);
                        await finalizeTx.wait();
                        console.log(`✅ Finalized vote tally for proposal ${proposalId}`);
                    } catch (error) {
                        console.error(`❌ Error finalizing proposal ${proposalId}:`, error);
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
    // Process ended proposals every 2 minutes
    setInterval(async () => {
        await processEndedProposals(mainContract, secondaryConnections);
    }, 2 * 60 * 1000);

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
