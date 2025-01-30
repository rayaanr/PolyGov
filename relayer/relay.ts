import { ethers } from "ethers";
import dotenv from "dotenv";
import { CHAINS_INFO } from "../constants/chains";
import { contracts } from "../constants/contracts";
import chalk from "chalk";
import fs from "fs";
import path from "path";

dotenv.config();

const CONFIG = {
    BSC: {
        RPC: process.env.BSC_RPC || CHAINS_INFO.BSC_TESTNET.pubRpcUrl,
        CONTRACT: contracts.bscTestnet.governanceContract,
        LAST_BLOCK_FILE: path.join(__dirname, "last_bsc_block.json"),
    },
    ARB: {
        RPC: process.env.ARB_RPC || CHAINS_INFO.ARB_TESTNET.pubRpcUrl,
        CONTRACT: contracts.arbitrumTestnet.governanceContract,
        LAST_BLOCK_FILE: path.join(__dirname, "last_arb_block.json"),
    },
};

// Governance ABI
const GOVERNANCE_ABI = [
    "function proposalCount() view returns (uint256)",
    "function proposals(uint256) view returns (uint256, string, string, uint256, uint256, uint256, uint256, uint8, uint256, uint256, bool)",
    "function mirrorProposal(uint256, string, string, uint256, uint256)",
    "function finalizeVoteTally(uint256, uint256, uint256)",
    "function executeProposal(uint256)",
    "event ProposalCreated(uint256 indexed, string, string, uint256, uint256)",
    "event VoteTallyFinalized(uint256 indexed, uint256, uint256)",
    "event ProposalExecuted(uint256 indexed, uint8)",
];

interface ContractInstances {
    bscProvider: ethers.JsonRpcProvider;
    arbProvider: ethers.JsonRpcProvider;
    bscSigner: ethers.Wallet;
    arbSigner: ethers.Wallet;
    GovernanceBSC: ethers.Contract;
    GovernanceARB: ethers.Contract;
    BscContractSigner: ethers.Contract;
    ArbContractSigner: ethers.Contract;
}

// Block tracking utilities
const readLastBlock = (chain: "BSC" | "ARB"): number => {
    try {
        return JSON.parse(fs.readFileSync(CONFIG[chain].LAST_BLOCK_FILE, "utf-8")).block;
    } catch {
        return 0;
    }
};

const writeLastBlock = (chain: "BSC" | "ARB", block: number) => {
    fs.writeFileSync(CONFIG[chain].LAST_BLOCK_FILE, JSON.stringify({ block }));
};

async function initializeContracts(): Promise<ContractInstances> {
    const bscProvider = new ethers.JsonRpcProvider(CONFIG.BSC.RPC);
    const arbProvider = new ethers.JsonRpcProvider(CONFIG.ARB.RPC);

    const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY!);
    const bscSigner = signer.connect(bscProvider);
    const arbSigner = signer.connect(arbProvider);

    const GovernanceBSC = new ethers.Contract(CONFIG.BSC.CONTRACT, GOVERNANCE_ABI, bscProvider);
    const GovernanceARB = new ethers.Contract(CONFIG.ARB.CONTRACT, GOVERNANCE_ABI, arbProvider);

    const BscContractSigner = GovernanceBSC.connect(bscSigner) as ethers.Contract;
    const ArbContractSigner = GovernanceARB.connect(arbSigner) as ethers.Contract;

    return {
        bscProvider,
        arbProvider,
        bscSigner,
        arbSigner,
        GovernanceBSC,
        GovernanceARB,
        BscContractSigner,
        ArbContractSigner,
    };
}

async function relayProposal(
    proposalId: bigint,
    title: string,
    description: string,
    sourceEndTime: bigint,
    targetContract: ethers.Contract,
    targetChain: "BSC" | "ARB"
) {
    try {
        const targetProvider = targetContract.runner?.provider;
        if (!targetProvider) throw new Error("Missing provider");

        // Get current block time on target chain
        const currentBlock = await targetProvider.getBlock("latest");
        if (!currentBlock) {
            throw new Error("Failed to fetch current block");
        }
        const newEndTime =
            BigInt(currentBlock.timestamp) + (sourceEndTime - BigInt(currentBlock.timestamp));

        // Check if proposal already exists
        const existingProposal = await targetContract.proposals(proposalId);
        if (existingProposal.startTime !== 0n) {
            console.log(chalk.yellow(`⚠️ Proposal ${proposalId} already exists on ${targetChain}`));
            return;
        }

        // Mirror proposal with corrected timing
        const tx = await targetContract.mirrorProposal(
            proposalId,
            title,
            description,
            currentBlock.timestamp,
            newEndTime.toString()
        );

        console.log(chalk.blue(`⏳ Relaying proposal ${proposalId} to ${targetChain}...`));
        await tx.wait();
        console.log(
            chalk.green(`✅ Proposal ${proposalId} successfully relayed to ${targetChain}`)
        );
    } catch (error) {
        console.error(
            chalk.red(`❌ Error relaying proposal ${proposalId} to ${targetChain}:`),
            error
        );
    }
}

async function syncProposals(contracts: ContractInstances) {
    try {
        const [bscCount, arbCount] = await Promise.all([
            contracts.GovernanceBSC.proposalCount(),
            contracts.GovernanceARB.proposalCount(),
        ]);

        console.log(chalk.blue(`🔄 Starting proposal sync: BSC(${bscCount}) ↔ ARB(${arbCount})`));

        // Sync BSC -> ARB
        if (bscCount > arbCount) {
            for (let id = arbCount + 1n; id <= bscCount; id++) {
                const proposal = await contracts.GovernanceBSC.proposals(id);
                await relayProposal(
                    id,
                    proposal.title,
                    proposal.description,
                    BigInt(proposal.endTime),
                    contracts.ArbContractSigner,
                    "ARB"
                );
            }
        }

        // Sync ARB -> BSC
        if (arbCount > bscCount) {
            for (let id = bscCount + 1n; id <= arbCount; id++) {
                const proposal = await contracts.GovernanceARB.proposals(id);
                await relayProposal(
                    id,
                    proposal.title,
                    proposal.description,
                    BigInt(proposal.endTime),
                    contracts.BscContractSigner,
                    "BSC"
                );
            }
        }

        console.log(chalk.green(`✅ Proposal sync complete`));
    } catch (error) {
        console.error(chalk.red(`❌ Error syncing proposals:`), error);
    }
}

async function processCompletedProposals(contracts: ContractInstances) {
    try {
        const proposalCount = await contracts.GovernanceBSC.proposalCount();
        console.log(chalk.blue(`🔍 Checking ${proposalCount} proposals for completion`));

        for (let id = 1n; id <= proposalCount; id++) {
            const [bscProposal, arbProposal] = await Promise.all([
                contracts.GovernanceBSC.proposals(id),
                contracts.GovernanceARB.proposals(id),
            ]);

            // Determine latest end time across chains
            const endTimes = [];
            if (bscProposal.startTime !== 0n) endTimes.push(BigInt(bscProposal.endTime));
            if (arbProposal.startTime !== 0n) endTimes.push(BigInt(arbProposal.endTime));
            const latestEndTime = endTimes.reduce((a, b) => (a > b ? a : b), 0n);

            // Skip if voting period not ended or already finalized
            if (latestEndTime === 0n || Date.now() / 1000 < Number(latestEndTime)) continue;
            if (bscProposal.voteTallyFinalized && arbProposal.voteTallyFinalized) continue;

            console.log(chalk.yellow(`📊 Processing votes for proposal ${id}`));

            // Aggregate votes
            const totalYes = BigInt(bscProposal.yesVotes) + BigInt(arbProposal.yesVotes);
            const totalNo = BigInt(bscProposal.noVotes) + BigInt(arbProposal.noVotes);

            // Finalize on both chains
            if (!bscProposal.voteTallyFinalized) {
                await contracts.BscContractSigner.finalizeVoteTally(id, totalYes, totalNo);
            }
            if (!arbProposal.voteTallyFinalized) {
                await contracts.ArbContractSigner.finalizeVoteTally(id, totalYes, totalNo);
            }

            // Execute proposals
            if (bscProposal.status === 0) {
                await contracts.BscContractSigner.executeProposal(id);
            }
            if (arbProposal.status === 0) {
                await contracts.ArbContractSigner.executeProposal(id);
            }

            console.log(chalk.green(`✅ Proposal ${id} processed`));
        }
    } catch (error) {
        console.error(chalk.red(`❌ Error processing proposals:`), error);
    }
}

async function pollNewEvents(contracts: ContractInstances) {
    try {
        // Poll BSC events
        const bscLastBlock = readLastBlock("BSC");
        const bscLogs = await contracts.bscProvider.getLogs({
            address: CONFIG.BSC.CONTRACT,
            fromBlock: bscLastBlock + 1,
            toBlock: "latest",
            topics: [ethers.id("ProposalCreated(uint256,string,string,uint256,uint256)")],
        });

        for (const log of bscLogs) {
            const decoded = contracts.GovernanceBSC.interface.decodeEventLog(
                "ProposalCreated",
                log.data,
                log.topics
            );

            await relayProposal(
                decoded.id,
                decoded.title,
                decoded.description,
                decoded.endTime,
                contracts.ArbContractSigner,
                "ARB"
            );
            writeLastBlock("BSC", log.blockNumber);
        }

        // Poll ARB events
        const arbLastBlock = readLastBlock("ARB");
        const arbLogs = await contracts.arbProvider.getLogs({
            address: CONFIG.ARB.CONTRACT,
            fromBlock: arbLastBlock + 1,
            toBlock: "latest",
            topics: [ethers.id("ProposalCreated(uint256,string,string,uint256,uint256)")],
        });

        for (const log of arbLogs) {
            const decoded = contracts.GovernanceARB.interface.decodeEventLog(
                "ProposalCreated",
                log.data,
                log.topics
            );

            await relayProposal(
                decoded.id,
                decoded.title,
                decoded.description,
                decoded.endTime,
                contracts.BscContractSigner,
                "BSC"
            );
            writeLastBlock("ARB", log.blockNumber);
        }
    } catch (error) {
        console.error(chalk.red(`❌ Error polling events:`), error);
    }
}

async function main() {
    console.log(chalk.blue("🚀 Starting Governance Relayer"));

    const contracts = await initializeContracts();
    await syncProposals(contracts);

    // Initial processing of any pending proposals
    await processCompletedProposals(contracts);

    // Set up regular intervals
    setInterval(() => pollNewEvents(contracts), 15000); // 15 seconds
    setInterval(() => processCompletedProposals(contracts), 60000); // 1 minute

    console.log(chalk.green("🏁 Relayer operational"));
}

main().catch((error) => {
    console.error(chalk.red("💥 Fatal error:"), error);
    process.exit(1);
});