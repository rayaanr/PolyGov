import { ethers } from "ethers";
import dotenv from "dotenv";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import { contracts } from "../constants/contracts";

dotenv.config();

/** ----------------------
 *  1. Configuration
 * --------------------- */
const CONFIG = {
    // Main chain configuration
    MAIN: {
        CHAIN_ID: "main",
        WS_URL: process.env.MAIN_WS_URL || "",
        CONTRACT: contracts.mainchain.governanceContract,
        LAST_BLOCK_FILE: path.join(__dirname, "last_main_block.json"),
    },
    // Secondary chains configuration (array of chains)
    SECONDARY_CHAINS: [
        {
            CHAIN_ID: "bsc",
            WS_URL: process.env.BSC_WS_URL || "",
            CONTRACT: contracts.bscTestnet.governanceContract,
            LAST_BLOCK_FILE: path.join(__dirname, "last_bsc_block.json"),
        },
        {
            CHAIN_ID: "arb",
            WS_URL: process.env.ARB_WS_URL || "",
            CONTRACT: contracts.arbitrumTestnet.governanceContract,
            LAST_BLOCK_FILE: path.join(__dirname, "last_arb_block.json"),
        },
        // Add more secondary chains as needed
    ],
};

// ABIs
const MAIN_GOVERNANCE_ABI = [
    "function proposals(bytes32) view returns (bytes32, string, string, uint256, uint256, uint256, uint256, uint256, uint256, uint8, uint256, uint256, bool)",
    "function createProposal(string, string, uint256)",
    "function collectSecondaryChainVotes(bytes32, string, uint256, uint256)",
    "function finalizeVoteTally(bytes32)",
    "function executeProposal(bytes32)",
    "function registerSecondaryChain(string)",
    "function getRegisteredChains() view returns (string[])",
    "event ProposalCreated(bytes32 indexed, string, string, uint256, uint256, uint256)",
    "function getAllProposalIds() view returns (bytes32[])",
    "function isMainChain() view returns (bool)",
];

const SECONDARY_GOVERNANCE_ABI = [
    "function proposals(bytes32) view returns (bytes32, string, string, uint256, uint256, uint256, uint256, uint256, uint256, uint8, bool)",
    "function mirrorProposal(bytes32, string, string, uint256, uint256, uint256)",
    "function tallyVotes(bytes32)",
    "function updateProposalStatus(bytes32, uint8)",
    "event Voted(bytes32 indexed, address indexed, bool, uint256)",
    "event VotesTallied(bytes32 indexed, uint256, uint256)",
    "function getAllProposalIds() view returns (bytes32[])",
    "function isMainChain() view returns (bool)",
    "function getChainId() view returns (string)",
];

/** -------------------------------------------------
 *  2. Last Block Tracking (File I/O)
 * ------------------------------------------------ */
async function readLastBlock(configEntry: any, provider: ethers.Provider): Promise<number> {
    try {
        // Check if the file exists and is non-empty
        if (
            !fs.existsSync(configEntry.LAST_BLOCK_FILE) ||
            fs.statSync(configEntry.LAST_BLOCK_FILE).size === 0
        ) {
            console.warn(`⚠️ Block file for ${configEntry.CHAIN_ID} is missing or empty.`);

            // Get the current block number and return (currentBlock - 1000)
            const currentBlock = await provider.getBlockNumber();
            const safeStartBlock = Math.max(currentBlock - 1000, 0);
            console.warn(`⏩ Defaulting to block ${safeStartBlock} (currentBlock - 1000).`);
            return safeStartBlock;
        }

        const data = JSON.parse(fs.readFileSync(configEntry.LAST_BLOCK_FILE, "utf8"));
        return data.block ?? 0;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.warn(
            `⚠️ Could not read or parse block file for ${configEntry.CHAIN_ID}: ${errorMessage}`
        );

        // On error, return currentBlock - 1000
        const currentBlock = await provider.getBlockNumber();
        const safeStartBlock = Math.max(currentBlock - 1000, 0);
        console.warn(`⏩ Defaulting to block ${safeStartBlock} due to read error.`);
        return safeStartBlock;
    }
}

function writeLastBlock(configEntry: any, block: number) {
    fs.writeFileSync(configEntry.LAST_BLOCK_FILE, JSON.stringify({ block }), "utf8");
}

/** -------------------------------------------------
 *  3. WebSocket Provider Creation
 * ------------------------------------------------ */
function createReconnectingProvider(wsUrl: string): ethers.WebSocketProvider {
    // Create WebSocket with custom reconnect logic
    let ws = createWebSocket(wsUrl);

    ws.onclose = (event) => {
        console.warn(
            `⚠️ WebSocket closed (code: ${event.code}, reason: ${event.reason}). Reconnecting...`
        );
        setTimeout(() => {
            ws = createWebSocket(wsUrl);
        }, 5000);
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    // Use ethers.js provider with the custom WebSocket
    return new ethers.WebSocketProvider(ws);
}

function createWebSocket(wsUrl: string): WebSocket {
    return new WebSocket(wsUrl);
}

/** -------------------------------------------------
 *  4. Contract Interfaces
 * ------------------------------------------------ */
interface MainProposal {
    // The shape matches the return structure from the ABI
    0: string; // id (bytes32)
    1: string; // title
    2: string; // description
    3: bigint; // yesVotes
    4: bigint; // noVotes
    5: bigint; // startTime
    6: bigint; // endTime
    7: bigint; // snapshotTimestamp
    8: bigint; // snapshotBlock
    9: number; // status (enum)
    10: bigint; // finalYesVotes
    11: bigint; // finalNoVotes
    12: boolean; // voteTallyFinalized
}

interface SecondaryProposal {
    0: string; // id (bytes32)
    1: string; // title
    2: string; // description
    3: bigint; // yesVotes
    4: bigint; // noVotes
    5: bigint; // startTime
    6: bigint; // endTime
    7: bigint; // snapshotTimestamp
    8: bigint; // snapshotBlock
    9: number; // status (enum)
    10: boolean; // voteTallied
}

/** -------------------------------------------------
 *  5. Initialization
 * ------------------------------------------------ */
interface ContractInstances {
    mainProvider: ethers.WebSocketProvider;
    mainContract: ethers.Contract;
    secondaryProviders: Record<string, ethers.WebSocketProvider>;
    secondaryContracts: Record<string, ethers.Contract>;
}

async function initializeContracts(): Promise<ContractInstances> {
    // Initialize main chain
    const mainProvider = createReconnectingProvider(CONFIG.MAIN.WS_URL);

    // Initialize secondary chains
    const secondaryProviders: Record<string, ethers.WebSocketProvider> = {};
    const secondaryContracts: Record<string, ethers.Contract> = {};

    // The same private key can sign transactions on all chains
    const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY || "");

    // Connect signer to main chain
    const mainSigner = signer.connect(mainProvider);
    const mainContract = new ethers.Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

    // Connect signer to each secondary chain
    for (const chain of CONFIG.SECONDARY_CHAINS) {
        const provider = createReconnectingProvider(chain.WS_URL);
        secondaryProviders[chain.CHAIN_ID] = provider;

        const chainSigner = signer.connect(provider);
        secondaryContracts[chain.CHAIN_ID] = new ethers.Contract(
            chain.CONTRACT,
            SECONDARY_GOVERNANCE_ABI,
            chainSigner
        );
    }

    return {
        mainProvider,
        mainContract,
        secondaryProviders,
        secondaryContracts,
    };
}

/** -------------------------------------------------
 *  6. Main to Secondary Chain Sync
 * ------------------------------------------------ */
async function syncMainToSecondary(
    mainContract: ethers.Contract,
    secondaryContract: ethers.Contract,
    chainId: string
) {
    console.log(`🔄 Syncing main chain proposals to ${chainId}`);

    // Get all proposal IDs from main chain
    const proposalIds = await mainContract.getAllProposalIds();
    console.log(`📄 Found ${proposalIds.length} proposals on main chain`);

    for (const proposalId of proposalIds) {
        try {
            // Check if proposal exists on secondary chain
            const secondaryProposal = await secondaryContract.proposals(proposalId);

            // If proposal doesn't exist (startTime = 0), mirror it
            if (secondaryProposal[5] === 0n) {
                console.log(chalk.yellow(`🚀 Mirroring proposal ${proposalId} to ${chainId}`));

                // Get proposal details from main chain
                const mainProposal = (await mainContract.proposals(proposalId)) as MainProposal;

                // Mirror proposal to secondary chain
                await mirrorProposal(
                    secondaryContract,
                    proposalId,
                    mainProposal[1], // title
                    mainProposal[2], // description
                    mainProposal[5], // startTime
                    mainProposal[6], // endTime
                    mainProposal[7], // snapshotTimestamp
                    chainId
                );
            } else {
                console.log(chalk.green(`✅ Proposal ${proposalId} already exists on ${chainId}`));
            }
        } catch (error) {
            console.error(`❌ Error syncing proposal ${proposalId} to ${chainId}:`, error);
        }
    }
}

/** -------------------------------------------------
 *  7. Mirror Proposal to Secondary Chain
 * ------------------------------------------------ */
async function mirrorProposal(
    secondaryContract: ethers.Contract,
    proposalId: string,
    title: string,
    description: string,
    startTime: bigint,
    endTime: bigint,
    snapshotTimestamp: bigint,
    chainId: string
) {
    try {
        console.log(`🔄 Mirroring proposal ${proposalId} to ${chainId}`);

        const tx = await secondaryContract.mirrorProposal(
            proposalId,
            title,
            description,
            startTime,
            endTime,
            snapshotTimestamp
        );
        await tx.wait();

        console.log(chalk.green(`✅ Proposal ${proposalId} mirrored to ${chainId}`));
    } catch (error) {
        console.error(`❌ Error mirroring proposal ${proposalId} to ${chainId}:`, error);
    }
}

/** -------------------------------------------------
 *  8. Listen for New Proposals on Main Chain
 * ------------------------------------------------ */
function listenForMainProposals(
    mainContract: ethers.Contract,
    secondaryContracts: Record<string, ethers.Contract>
) {
    mainContract.on(
        "ProposalCreated",
        async (
            id: string,
            title: string,
            description: string,
            startTime: bigint,
            endTime: bigint,
            snapshotTimestamp: bigint,
            event: any
        ) => {
            console.log(chalk.blue(`📢 New proposal on main chain: ID ${id} - ${title}`));

            // Mirror to all secondary chains
            for (const [chainId, contract] of Object.entries(secondaryContracts)) {
                await mirrorProposal(
                    contract,
                    id,
                    title,
                    description,
                    startTime,
                    endTime,
                    snapshotTimestamp,
                    chainId
                );
            }
        }
    );
}

/** -------------------------------------------------
 *  9. Collect Votes from Secondary Chains
 * ------------------------------------------------ */
async function collectSecondaryVotes(
    proposalId: string,
    mainContract: ethers.Contract,
    secondaryContracts: Record<string, ethers.Contract>
) {
    console.log(`🗳️ Collecting votes for proposal ${proposalId}`);

    const mainProposal = (await mainContract.proposals(proposalId)) as MainProposal;

    // Skip if voting period hasn't ended
    const currentTime = Math.floor(Date.now() / 1000);
    if (Number(mainProposal[6]) > currentTime) {
        console.log(`⏳ Voting period still active for ${proposalId}`);
        return;
    }

    // Skip if already finalized
    if (mainProposal[12]) {
        console.log(`✅ Votes already finalized for ${proposalId}`);
        return;
    }

    // Collect votes from all secondary chains
    for (const [chainId, contract] of Object.entries(secondaryContracts)) {
        try {
            const secondaryProposal = (await contract.proposals(proposalId)) as SecondaryProposal;

            // Skip if voting period hasn't ended on secondary chain
            if (Number(secondaryProposal[6]) > currentTime) {
                console.log(`⏳ Voting period still active for ${proposalId} on ${chainId}`);
                continue;
            }

            // Trigger vote tallying on secondary chain if not already tallied
            if (!secondaryProposal[10]) {
                console.log(`🔢 Tallying votes for ${proposalId} on ${chainId}`);
                const tx = await contract.tallyVotes(proposalId);
                await tx.wait();

                // Refresh proposal data after tallying
                const updatedProposal = (await contract.proposals(proposalId)) as SecondaryProposal;

                // Submit vote totals to main chain
                await mainContract.collectSecondaryChainVotes(
                    proposalId,
                    chainId,
                    updatedProposal[3], // yesVotes
                    updatedProposal[4] // noVotes
                );

                console.log(chalk.green(`✅ Votes for ${proposalId} collected from ${chainId}`));
            } else {
                console.log(`✅ Votes already tallied for ${proposalId} on ${chainId}`);
            }
        } catch (error) {
            console.error(`❌ Error collecting votes for ${proposalId} from ${chainId}:`, error);
        }
    }
}

/** -------------------------------------------------
 *  10. Finalize and Execute Proposals
 * ------------------------------------------------ */
async function finalizeAndExecuteProposals(
    mainContract: ethers.Contract,
    secondaryContracts: Record<string, ethers.Contract>
) {
    console.log(`🏁 Checking for proposals to finalize and execute`);

    // Get all proposal IDs from main chain
    const proposalIds = await mainContract.getAllProposalIds();
    console.log(`📄 Found ${proposalIds.length} proposals on main chain`);
    for (const proposalId of proposalIds) {
        try {
            const mainProposal = (await mainContract.proposals(proposalId)) as MainProposal;
            // Skip if voting period hasn't ended
            const currentTime = Math.floor(Date.now() / 1000);
            if (Number(mainProposal[6]) > currentTime) {
                console.log(`⏳ Voting period still active for ${proposalId}`);
                continue;
            }
            // Skip if already finalized
            if (mainProposal[12]) {
                console.log(`✅ Proposal ${proposalId} already finalized`);
                continue;
            }
            // Finalize vote tally on main chain
            const tx = await mainContract.finalizeVoteTally(proposalId);
            await tx.wait();
            console.log(chalk.green(`✅ Finalized vote tally for ${proposalId}`));
            // Execute proposal on main chain
            const executeTx = await mainContract.executeProposal(proposalId);
            await executeTx.wait();
            console.log(chalk.green(`✅ Executed proposal ${proposalId}`));
            // Update proposal status on secondary chains
            for (const [chainId, contract] of Object.entries(secondaryContracts)) {
                const updateTx = await contract.updateProposalStatus(proposalId, 1); // 1 for executed
                await updateTx.wait();
                console.log(chalk.green(`✅ Updated proposal status on ${chainId}`));
            }
        } catch (error) {
            console.error(`❌ Error finalizing or executing proposal ${proposalId}:`, error);
        }
    }
}
/** -------------------------------------------------
 *  11. Main Function
 * ------------------------------------------------ */
async function main() {
    // Initialize contract instances
    const { mainProvider, mainContract, secondaryProviders, secondaryContracts } =
        await initializeContracts();

    // Read last block numbers
    const lastMainBlock = await readLastBlock(CONFIG.MAIN, mainProvider);
    console.log(`📦 Last processed block on main chain: ${lastMainBlock}`);

    // Listen for new proposals on the main chain
    listenForMainProposals(mainContract, secondaryContracts);

    // Sync proposals from main to secondary chains
    for (const chain of CONFIG.SECONDARY_CHAINS) {
        await syncMainToSecondary(mainContract, secondaryContracts[chain.CHAIN_ID], chain.CHAIN_ID);
    }

    // Collect votes from secondary chains
    for (const chain of CONFIG.SECONDARY_CHAINS) {
        await collectSecondaryVotes(chain.CHAIN_ID, mainContract, secondaryContracts);
    }

    // Finalize and execute proposals
    await finalizeAndExecuteProposals(mainContract, secondaryContracts);

    // Write last block number
    writeLastBlock(CONFIG.MAIN, lastMainBlock);
}

main()
    .then(() => console.log(chalk.green("✅ Relayer started successfully")))
    .catch((error) => {
        console.error(chalk.red("❌ Error starting relayer:"), error);
        process.exit(1);
    });
