import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import WebSocket from "ws";

dotenv.config();

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

const CONFIG = {
    MAIN: {
        CHAIN_ID: "main",
        RPC_URL: process.env.BSC_RPC || "",
        WS_URL: process.env.BSC_WS_URL || "",
        CONTRACT: "0x4F90cb1474bF846682B267e62cEA52505477B378",
    },
    SECONDARY_CHAINS: [
        {
            CHAIN_ID: "arb",
            RPC_URL: process.env.ARB_RPC || "",
            WS_URL: process.env.ARB_WS_URL || "",
            CONTRACT: "0x82ACdE34e54B408E808a8f625648ED4eCe7A745e",
        },
    ],
};

const MAIN_GOVERNANCE_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/main.json"), "utf8")
);

const SECONDARY_GOVERNANCE_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/secondary.json"), "utf8")
);

const CACHE_FILE_PATH = path.join(__dirname, "proposal_cache.json");

function createWebSocketProvider(wsUrl: string): ethers.WebSocketProvider {
    const ws = new WebSocket(wsUrl, {
        perMessageDeflate: false,
        timeout: 30000,
    });

    const provider = new ethers.WebSocketProvider(ws as any, undefined, {
        pollingInterval: 1000,
    });

    ws.on("error", (error) => {
        console.error(`WebSocket error for ${wsUrl}:`, error);
    });

    ws.on("close", () => {
        console.log(`WebSocket closed for ${wsUrl}, will attempt to reconnect...`);
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

    const mainProvider = createWebSocketProvider(CONFIG.MAIN.WS_URL);
    const mainSigner = new ethers.Wallet(process.env.RELAYER_PVT_KEY, mainProvider);
    const mainContract = new ethers.Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

    const secondaryConnections: Record<string, ContractConnections> = {};

    for (const chain of CONFIG.SECONDARY_CHAINS) {
        try {
            const provider = createWebSocketProvider(chain.WS_URL);
            const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY, provider);
            const contract = new ethers.Contract(chain.CONTRACT, SECONDARY_GOVERNANCE_ABI, signer);

            secondaryConnections[chain.CHAIN_ID] = {
                provider,
                contract,
                signer,
                wsInstance: provider.websocket as WebSocket,
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
            wsInstance: mainProvider.websocket as WebSocket,
        },
        secondary: secondaryConnections,
    };
}

function setupMainChainEventListeners(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🎧 Setting up event listeners for main chain");

    mainContract.on("ProposalCreated", async (id, title, endTime, event) => {
        console.log(`🆕 New proposal created on main chain: ${id} - ${title}`);
        try {
            const proposal = await mainContract.getProposalDetails(id);
            for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                try {
                    console.log(`🔄 Mirroring proposal ${id} to ${chainId}`);
                    try {
                        const secondaryProposal = await contract.getProposalDetails(id);
                        if (secondaryProposal.startTime > 0) {
                            console.log(`ℹ️ Proposal ${id} already exists on ${chainId}`);
                            continue;
                        }
                    } catch (err) {}
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

async function checkAndCollectVotes(
    mainContract: ethers.Contract,
    chainId: string,
    proposalId: string,
    yesVotes: bigint,
    noVotes: bigint
): Promise<boolean> {
    try {
        const secondaryVotes = await mainContract.secondaryChainVotes(proposalId, chainId);
        if (secondaryVotes.collected) {
            console.log(`ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`);
            return true;
        }
    } catch (err: any) {
        if (err.reason?.toLowerCase().includes("votes already collected")) {
            console.log(`ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`);
            return true;
        }
    }

    try {
        const tx = await mainContract.collectSecondaryChainVotes(
            proposalId,
            chainId,
            yesVotes,
            noVotes
        );
        await tx.wait();
        console.log(`✅ Collected votes from ${chainId} for proposal ${proposalId}`);
        return true;
    } catch (err: any) {
        if (err.reason?.toLowerCase().includes("votes already collected")) {
            console.log(`ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`);
            return true;
        }
        throw err;
    }
}

async function finalizeVotesIfPossible(
    mainContract: ethers.Contract,
    proposalId: string,
    endTime: number,
    cache: ProposalCache
): Promise<void> {
    const currentTime = Math.floor(Date.now() / 1000);
    const cooldownEndTime = Number(endTime) + 3 * 60;

    if (currentTime >= cooldownEndTime) {
        try {
            console.log(`🔢 Finalizing vote tally for proposal ${proposalId}`);
            const finalizeTx = await mainContract.finalizeProposalVotes(proposalId);
            await finalizeTx.wait();
            console.log(`✅ Finalized vote tally for proposal ${proposalId}`);
            markProposalAsFinalized(proposalId.toString(), cache);
        } catch (error) {
            console.error(`❌ Error finalizing proposal ${proposalId}:`, error);
        }
    }
}

async function mirrorAndFinalizeProposal(
    contract: ethers.Contract,
    proposalId: string,
    proposal: any,
    chainId: string,
    isExpired: boolean
): Promise<void> {
    try {
        const tx = await contract.mirrorProposal(
            proposalId,
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime
        );
        await tx.wait();
        console.log(`✅ Proposal ${proposalId} mirrored to ${chainId}`);

        if (isExpired) {
            const finalizeTx = await contract.finalizeVotes(proposalId);
            await finalizeTx.wait();
            console.log(
                `✅ Votes finalized for newly mirrored expired proposal ${proposalId} on ${chainId}`
            );
        }
    } catch (error) {
        console.error(`❌ Error mirroring/finalizing proposal ${proposalId} on ${chainId}:`, error);
    }
}

function setupSecondaryChainEventListeners(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🎧 Setting up event listeners for secondary chains");

    for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
        contract.on("VotesTallied", async (proposalId, yesVotes, noVotes, event) => {
            console.log(
                `🗳️ Votes tallied for proposal ${proposalId} on ${chainId}: Yes=${yesVotes}, No=${noVotes}`
            );
            try {
                if (
                    await checkAndCollectVotes(mainContract, chainId, proposalId, yesVotes, noVotes)
                ) {
                    const proposal = await mainContract.getProposalDetails(proposalId);
                    if (!proposal.voteTallyFinalized) {
                        await finalizeVotesIfPossible(
                            mainContract,
                            proposalId,
                            Number(proposal.endTime),
                            loadProposalCache()
                        );
                    }
                }
            } catch (error) {
                console.error(`❌ Error processing votes for ${proposalId} on ${chainId}:`, error);
            }
        });
    }
}

async function syncExistingProposals(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🔄 Syncing existing proposals from main chain to secondary chains");
    const cache = loadProposalCache();
    const finalizedIds = new Set(cache.finalized.map((p) => p.id));

    try {
        const proposalIds = await mainContract.getProposalIds();
        console.log(`📄 Found ${proposalIds.length} proposals on main chain`);
        const currentTime = Math.floor(Date.now() / 1000);

        for (const proposalId of proposalIds) {
            // Skip if proposal is already finalized
            if (finalizedIds.has(proposalId.toString())) {
                console.log(`⏩ Skipping finalized proposal ${proposalId}`);
                continue;
            }

            try {
                const mainProposal = await mainContract.getProposalDetails(proposalId);
                // Mark as finalized if it's already finalized on-chain
                if (mainProposal.voteTallyFinalized) {
                    markProposalAsFinalized(proposalId.toString(), cache);
                    console.log(`⏩ Skipping newly detected finalized proposal ${proposalId}`);
                    continue;
                }

                console.log(
                    `🔍 Processing proposal ${proposalId} - End Time: ${mainProposal.endTime}, Current Time: ${currentTime}`
                );
                const isExpired = Number(mainProposal.endTime) <= currentTime;

                for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                    try {
                        let secondaryProposal;
                        let proposalExists = true;
                        console.log(`🔎 Checking proposal ${proposalId} on ${chainId}`);
                        try {
                            secondaryProposal = await contract.getProposalDetails(proposalId);
                            console.log(
                                `ℹ️ Proposal ${proposalId} found on ${chainId}, voteTallied: ${secondaryProposal.voteTallied}`
                            );
                        } catch (err) {
                            console.log(`⚠️ Proposal ${proposalId} not found on ${chainId}`);
                            proposalExists = false;
                        }

                        if (!proposalExists || secondaryProposal.startTime === 0n) {
                            console.log(
                                `🔄 Mirroring missing proposal ${proposalId} to ${chainId}`
                            );
                            await mirrorAndFinalizeProposal(
                                contract,
                                proposalId,
                                mainProposal,
                                chainId,
                                isExpired
                            );
                        } else if (isExpired && !secondaryProposal.voteTallied) {
                            console.log(
                                `⏳ Proposal ${proposalId} exists but not finalized on ${chainId}, finalizing`
                            );
                            try {
                                const finalizeTx = await contract.finalizeVotes(proposalId);
                                await finalizeTx.wait();
                                console.log(
                                    `✅ Proposal ${proposalId} votes finalized on ${chainId}`
                                );
                            } catch (error) {
                                console.error(
                                    `❌ Failed to finalize existing proposal ${proposalId} on ${chainId}:`,
                                    error
                                );
                            }
                        } else if (
                            mainProposal.status !== secondaryProposal.status &&
                            mainProposal.status !== 0
                        ) {
                            console.log(
                                `🔄 Updating status for proposal ${proposalId} on ${chainId}`
                            );
                            const tx = await contract.updateProposalStatus(
                                proposalId,
                                mainProposal.status
                            );
                            await tx.wait();
                            console.log(`✅ Updated proposal ${proposalId} status on ${chainId}`);
                        } else {
                            console.log(
                                `✅ Proposal ${proposalId} already synced and up-to-date on ${chainId}`
                            );
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

async function processEndedProposals(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🔄 Processing proposals with ended voting periods");
    const cache = loadProposalCache();

    try {
        const proposalIds = await mainContract.getProposalIds();
        const currentTime = Math.floor(Date.now() / 1000);
        const finalizedIds = new Set(cache.finalized.map((p) => p.id));

        for (const proposalId of proposalIds) {
            // Skip if proposal is already finalized
            if (finalizedIds.has(proposalId.toString())) {
                continue;
            }

            try {
                const mainProposal = await mainContract.getProposalDetails(proposalId);

                if (Number(mainProposal.endTime) > currentTime || mainProposal.voteTallyFinalized) {
                    if (mainProposal.voteTallyFinalized) {
                        markProposalAsFinalized(proposalId.toString(), cache);
                    }
                    continue;
                }

                const registeredChains = await mainContract.getRegisteredChains();

                for (const chainId of registeredChains) {
                    if (!secondaryConnections[chainId]) continue;

                    try {
                        const { contract } = secondaryConnections[chainId];
                        let secondaryProposal;
                        let proposalExists = true;

                        try {
                            secondaryProposal = await contract.getProposalDetails(proposalId);
                            console.log(
                                `ℹ️ Proposal ${proposalId} on ${chainId} - VoteTallied: ${secondaryProposal.voteTallied}`
                            );
                        } catch (err) {
                            console.log(`⚠️ Proposal ${proposalId} not found on ${chainId}`);
                            proposalExists = false;
                        }

                        if (!proposalExists || secondaryProposal.startTime === 0n) {
                            console.log(
                                `⚠️ Proposal ${proposalId} missing on ${chainId}, mirroring`
                            );
                            await mirrorAndFinalizeProposal(
                                contract,
                                proposalId,
                                mainProposal,
                                chainId,
                                true
                            );
                            secondaryProposal = await contract.getProposalDetails(proposalId);
                        }

                        // Check if votes are already collected before proceeding
                        let votesCollected = false;
                        try {
                            const secondaryVotes = await mainContract.secondaryChainVotes(
                                proposalId,
                                chainId
                            );
                            votesCollected = secondaryVotes.collected;
                            console.log(
                                `ℹ️ Votes collected status for ${proposalId} on ${chainId}: ${votesCollected}`
                            );
                            if (votesCollected) {
                                console.log(
                                    `⏩ Skipping vote collection for ${proposalId} on ${chainId} - votes already collected`
                                );
                                continue;
                            }
                        } catch (err) {
                            console.log(
                                `⚠️ Could not check vote collection status for ${proposalId} on ${chainId}, proceeding`
                            );
                        }

                        if (
                            !secondaryProposal.voteTallied &&
                            Number(secondaryProposal.endTime) <= currentTime
                        ) {
                            console.log(`🗳️ Finalizing votes for ${proposalId} on ${chainId}`);
                            const finalizeTx = await contract.finalizeVotes(proposalId);
                            await finalizeTx.wait();
                            console.log(`✅ Votes finalized for ${proposalId} on ${chainId}`);
                            secondaryProposal = await contract.getProposalDetails(proposalId);
                        }

                        if (secondaryProposal.voteTallied && !votesCollected) {
                            console.log(`📊 Collecting votes for ${proposalId} from ${chainId}`);
                            try {
                                const collectTx = await mainContract.collectSecondaryChainVotes(
                                    proposalId,
                                    chainId,
                                    secondaryProposal.yesVotes,
                                    secondaryProposal.noVotes
                                );
                                await collectTx.wait();
                                console.log(
                                    `✅ Collected votes from ${chainId} for proposal ${proposalId}`
                                );
                            } catch (err: any) {
                                if (err.reason?.toLowerCase().includes("votes already collected")) {
                                    console.log(
                                        `ℹ️ Votes already collected from ${chainId} for proposal ${proposalId}`
                                    );
                                    continue;
                                }
                                throw err;
                            }
                        } else if (votesCollected) {
                            console.log(
                                `⏩ Votes already collected for ${proposalId} on ${chainId}, skipping`
                            );
                        } else {
                            console.log(
                                `⚠️ Votes not tallied for ${proposalId} on ${chainId}, cannot collect`
                            );
                        }
                    } catch (error) {
                        console.error(
                            `❌ Error processing votes from ${chainId} for ${proposalId}:`,
                            error
                        );
                    }
                }

                await finalizeVotesIfPossible(
                    mainContract,
                    proposalId,
                    Number(mainProposal.endTime),
                    cache
                );
            } catch (error) {
                console.error(`❌ Error processing proposal ${proposalId}:`, error);
            }
        }
    } catch (error) {
        console.error("❌ Error processing ended proposals:", error);
    }
}

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

function scheduleRecurringTasks(
    mainContract: ethers.Contract,
    secondaryConnections: Record<string, ContractConnections>
) {
    setInterval(async () => {
        await processEndedProposals(mainContract, secondaryConnections);
    }, 2 * 60 * 1000);

    setInterval(async () => {
        await syncExistingProposals(mainContract, secondaryConnections);
    }, 60 * 60 * 1000);
}

async function main() {
    console.log("🔗 Starting Multi-Chain Governance Relayer with WebSockets");
    try {
        // Initialize cache if it doesn't exist
        if (!fs.existsSync(CACHE_FILE_PATH)) {
            saveProposalCache({ finalized: [], lastUpdate: Math.floor(Date.now() / 1000) });
        }

        const connections = await initializeContracts();
        setupWebSocketHealthCheck(connections);
        setupMainChainEventListeners(connections.main.contract, connections.secondary);
        setupSecondaryChainEventListeners(connections.main.contract, connections.secondary);
        await syncExistingProposals(connections.main.contract, connections.secondary);
        await processEndedProposals(connections.main.contract, connections.secondary);
        scheduleRecurringTasks(connections.main.contract, connections.secondary);
        console.log("✅ Relayer initialized and running");
    } catch (error) {
        console.error("❌ Error initializing relayer:", error);
        process.exit(1);
    }
}

process.on("SIGINT", async () => {
    console.log("👋 Gracefully shutting down...");
    process.exit(0);
});

main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
});
