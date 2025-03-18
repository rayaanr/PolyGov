import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

/**
 * This relayer acts as a bridge between the main governance chain and secondary chains
 * to synchronize proposals and votes across the network.
 */

/**
 * Configuration settings for main and secondary chains
 */
const CONFIG = {
    // Main chain configuration
    MAIN: {
        CHAIN_ID: "main",
        RPC_URL: process.env.BSC_RPC || "",
        CONTRACT: "0x7c0dfdD559fC07e801dB68781647e5F3AE7492Ef",
        LAST_BLOCK_FILE: path.join(__dirname, "last_main_block.txt"),
    },
    // Secondary chains configuration
    SECONDARY_CHAINS: [
        {
            CHAIN_ID: "arb",
            RPC_URL: process.env.ARB_RPC || "",
            CONTRACT: "0xa6bA1c44442bf0d579B36201004dD5174061Db31",
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
async function readLastBlock(configEntry: any, provider: ethers.Provider): Promise<number> {
    try {
        if (!fs.existsSync(configEntry.LAST_BLOCK_FILE)) {
            const currentBlock = await provider.getBlockNumber();
            const safeStartBlock = Math.max(currentBlock - 1000, 0);
            return safeStartBlock;
        }

        const blockNumber = parseInt(fs.readFileSync(configEntry.LAST_BLOCK_FILE, "utf8"), 10);
        return isNaN(blockNumber) ? 0 : blockNumber;
    } catch (error) {
        console.warn(`⚠️ Error reading block file for ${configEntry.CHAIN_ID}`);
        const currentBlock = await provider.getBlockNumber();
        return Math.max(currentBlock - 1000, 0);
    }
}

/**
 * Write the last processed block to file
 */
function writeLastBlock(configEntry: any, block: number): void {
    fs.writeFileSync(configEntry.LAST_BLOCK_FILE, block.toString(), "utf8");
}

/**
 * Initialize providers and contracts
 */
async function initializeContracts() {
    // Initialize main chain
    const mainProvider = new ethers.JsonRpcProvider(CONFIG.MAIN.RPC_URL);

    // Initialize secondary chains
    const secondaryProviders: Record<string, ethers.Provider> = {};
    const secondaryContracts: Record<string, ethers.Contract> = {};

    // The same private key can sign transactions on all chains
    const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY || "");

    // Connect signer to main chain
    const mainSigner = signer.connect(mainProvider);
    const mainContract = new ethers.Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

    // Connect signer to each secondary chain
    for (const chain of CONFIG.SECONDARY_CHAINS) {
        const provider = new ethers.JsonRpcProvider(chain.RPC_URL);
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

/**
 * Sync proposals from main chain to secondary chains
 */
async function syncMainToSecondary(
    mainContract: ethers.Contract,
    secondaryContract: ethers.Contract,
    chainId: string
) {
    console.log(`🔄 Syncing proposals from main chain to ${chainId}`);

    try {
        // Get all proposal IDs from main chain
        const proposalIds = await mainContract.getAllProposalIds();
        console.log(`📄 Found ${proposalIds.length} proposals on main chain`);

        for (const proposalId of proposalIds) {
            try {
                // Check if proposal exists on secondary chain
                const secondaryProposal = await secondaryContract.proposals(proposalId);

                // If proposal doesn't exist (startTime = 0), mirror it
                if (secondaryProposal[5] === 0n) {
                    console.log(`🚀 Mirroring proposal ${proposalId} to ${chainId}`);

                    // Get proposal details from main chain
                    const mainProposal = await mainContract.proposals(proposalId);

                    // Mirror proposal to secondary chain
                    const tx = await secondaryContract.mirrorProposal(
                        proposalId,
                        mainProposal[1], // title
                        mainProposal[2], // description
                        mainProposal[5], // startTime
                        mainProposal[6], // endTime
                        mainProposal[7] // snapshotTimestamp
                    );
                    await tx.wait();

                    console.log(`✅ Proposal ${proposalId} mirrored to ${chainId}`);
                } else {
                    console.log(`✓ Proposal ${proposalId} already exists on ${chainId}`);
                }
            } catch (error) {
                console.error(`❌ Error syncing proposal ${proposalId} to ${chainId}:`, error);
            }
        }
    } catch (error) {
        console.error(`❌ Error syncing proposals to ${chainId}:`, error);
    }
}

/**
 * Collect votes from secondary chains to main chain
 */
async function collectSecondaryVotes(
    mainContract: ethers.Contract,
    secondaryContracts: Record<string, ethers.Contract>
) {
    console.log(`🗳️ Collecting votes from secondary chains`);

    try {
        // Get all proposal IDs from main chain
        const proposalIds = await mainContract.getAllProposalIds();

        for (const proposalId of proposalIds) {
            const mainProposal = await mainContract.proposals(proposalId);

            // Skip if voting period hasn't ended
            const currentTime = Math.floor(Date.now() / 1000);
            if (Number(mainProposal[6]) > currentTime) {
                console.log(`⏳ Voting period still active for ${proposalId}`);
                continue;
            }

            // Skip if already finalized
            if (mainProposal[11]) {
                console.log(`✅ Votes already finalized for ${proposalId}`);
                continue;
            }

            // Collect votes from all secondary chains
            for (const [chainId, contract] of Object.entries(secondaryContracts)) {
                try {
                    const secondaryProposal = await contract.proposals(proposalId);

                    // Skip if voting period hasn't ended on secondary chain
                    if (Number(secondaryProposal[6]) > currentTime) {
                        console.log(
                            `⏳ Voting period still active for ${proposalId} on ${chainId}`
                        );
                        continue;
                    }

                    // Trigger vote tallying on secondary chain if not already tallied
                    if (!secondaryProposal[9]) {
                        console.log(`🗳️ Tallying votes for ${proposalId} on ${chainId}`);
                        const tx = await contract.tallyVotes(proposalId);
                        await tx.wait();
                        console.log(`✅ Votes tallied for ${proposalId} on ${chainId}`);
                    } else {
                        console.log(`✓ Votes already tallied for ${proposalId} on ${chainId}`);
                    }
                    // Collect votes from secondary chain to main chain
                    const tx = await mainContract.collectSecondaryChainVotes(
                        proposalId,
                        chainId,
                        secondaryProposal[7], // forVotes
                        secondaryProposal[8] // againstVotes
                    );
                    await tx.wait();
                    console.log(`✅ Collected votes from ${chainId} for ${proposalId}`);
                } catch (error) {
                    console.error(
                        `❌ Error collecting votes from ${chainId} for ${proposalId}:`,
                        error
                    );
                }
            }
            // Finalize vote tallying on main chain
            try {
                const tx = await mainContract.finalizeVoteTally(proposalId);
                await tx.wait();
                console.log(`✅ Finalized vote tally for ${proposalId}`);
            } catch (error) {
                console.error(`❌ Error finalizing vote tally for ${proposalId}:`, error);
            }
        }
    } catch (error) {
        console.error(`❌ Error collecting votes from secondary chains:`, error);
    }
}
/**
 * Execute proposals on main chain
 */
async function executeProposals(mainContract: ethers.Contract) {
    console.log(`🚀 Executing proposals on main chain`);

    try {
        // Get all proposal IDs from main chain
        const proposalIds = await mainContract.getAllProposalIds();

        for (const proposalId of proposalIds) {
            try {
                const mainProposal = await mainContract.proposals(proposalId);

                // Skip if already executed
                if (mainProposal[11]) {
                    console.log(`✅ Proposal ${proposalId} already executed`);
                    continue;
                }
                // Skip if voting period hasn't ended
                const currentTime = Math.floor(Date.now() / 1000);
                if (Number(mainProposal[6]) > currentTime) {
                    console.log(`⏳ Voting period still active for ${proposalId}`);
                    continue;
                }
                // Execute proposal
                const tx = await mainContract.executeProposal(proposalId);
                await tx.wait();
                console.log(`✅ Executed proposal ${proposalId}`);
            } catch (error) {
                console.error(`❌ Error executing proposal ${proposalId}:`, error);
            }
        }
    } catch (error) {
        console.error(`❌ Error executing proposals:`, error);
    }
}
/**
 * Main function to run the relayer
 */
async function main() {
    console.log("🔗 Starting Multi-Chain Governance Relayer");

    // Initialize contracts and providers
    const { mainProvider, mainContract, secondaryProviders, secondaryContracts } =
        await initializeContracts();

    // Read last processed block for main chain
    const lastMainBlock = await readLastBlock(CONFIG.MAIN, mainProvider);
    console.log(`📊 Last processed block on main chain: ${lastMainBlock}`);

    // Sync proposals from main chain to secondary chains
    for (const chain of CONFIG.SECONDARY_CHAINS) {
        await syncMainToSecondary(mainContract, secondaryContracts[chain.CHAIN_ID], chain.CHAIN_ID);
    }

    // Collect votes from secondary chains to main chain
    await collectSecondaryVotes(mainContract, secondaryContracts);

    // Execute proposals on main chain
    await executeProposals(mainContract);

    // Write last processed block for main chain
    writeLastBlock(CONFIG.MAIN, lastMainBlock + 1);
}
main()
    .then(() => {
        console.log("✅ Relayer finished successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Relayer encountered an error:", error);
        process.exit(1);
    });
