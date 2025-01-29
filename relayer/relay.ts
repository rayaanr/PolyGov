// src/relayer/index.ts
import { ethers } from "ethers";
import dotenv from "dotenv";
import { CHAINS_INFO } from "../constants/chains";
import { contracts } from "../constants/contracts";
import chalk from "chalk";

dotenv.config();

const CONFIG = {
    BSC: {
        RPC: process.env.BSC_RPC || CHAINS_INFO.BSC_TESTNET.pubRpcUrl,
        CONTRACT: contracts.bscTestnet.governanceContract,
    },
    ARB: {
        RPC: process.env.ARB_RPC || CHAINS_INFO.ARB_TESTNET.pubRpcUrl,
        CONTRACT: contracts.arbitrumTestnet.governanceContract,
    },
};

// Complete ABI with all required functions
const GOVERNANCE_ABI = [
    "function proposalCount() view returns (uint256)",
    "function proposals(uint256) view returns (uint256 id, string title, string description, uint256 yesVotes, uint256 noVotes, uint256 startTime, uint256 endTime, uint8 status, uint256 finalYesVotes, uint256 finalNoVotes, bool voteTallyFinalized)",
    "function mirrorProposal(uint256 id, string title, string description, uint256 startTime, uint256 endTime)",
    "function finalizeVoteTally(uint256 id, uint256 totalYesVotes, uint256 totalNoVotes)",
    "function executeProposal(uint256 id)",
    "event ProposalCreated(uint256 indexed id, string title, string description, uint256 startTime, uint256 endTime)",
    "event VoteTallyFinalized(uint256 indexed id, uint256 totalYesVotes, uint256 totalNoVotes)",
    "event ProposalExecuted(uint256 indexed id, uint8 status)"
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

async function initializeContracts(): Promise<ContractInstances> {
    const bscProvider = new ethers.JsonRpcProvider(CONFIG.BSC.RPC);
    const arbProvider = new ethers.JsonRpcProvider(CONFIG.ARB.RPC);
    
    const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY!);
    const bscSigner = signer.connect(bscProvider);
    const arbSigner = signer.connect(arbProvider);

    const GovernanceBSC = new ethers.Contract(
        CONFIG.BSC.CONTRACT,
        GOVERNANCE_ABI,
        bscProvider
    );

    const GovernanceARB = new ethers.Contract(
        CONFIG.ARB.CONTRACT,
        GOVERNANCE_ABI,
        arbProvider
    );

    const BscContractSigner = new ethers.Contract(
        CONFIG.BSC.CONTRACT,
        GOVERNANCE_ABI,
        bscSigner
    );

    const ArbContractSigner = new ethers.Contract(
        CONFIG.ARB.CONTRACT,
        GOVERNANCE_ABI,
        arbSigner
    );

    return {
        bscProvider,
        arbProvider,
        bscSigner,
        arbSigner,
        GovernanceBSC,
        GovernanceARB,
        BscContractSigner,
        ArbContractSigner
    };
}

async function relayProposalWithRetry(
    proposalId: bigint,
    title: string,
    description: string,
    startTime: bigint,
    endTime: bigint,
    targetGovernance: ethers.Contract
) {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            console.log(chalk.blue(`🔍 Checking if proposal ${proposalId} exists on target contract: ${targetGovernance.address}`));

            const proposal = await targetGovernance.proposals(proposalId);
            
            if (proposal.startTime.toString() !== "0") {
                console.log(chalk.yellow(`⚠️ Proposal ${proposalId} already exists on target chain. Skipping.`));
                return;
            }

            const tx = await targetGovernance.mirrorProposal(
                proposalId,
                title,
                description,
                startTime.toString(),
                endTime.toString()
            );
            
            console.info(`⏳ Relaying... TX hash: ${chalk.underline(tx.hash)}`);
            await tx.wait();
            console.log(chalk.green(`✅ Proposal ${chalk.bold(proposalId)} relayed!`));
            break;
        } catch (error) {
            attempts++;
            console.error(`❌ Attempt ${attempts} failed to relay proposal:`, error);
            if (attempts >= maxAttempts) {
                throw new Error(`Failed to relay proposal ${proposalId} after ${maxAttempts} attempts.`);
            }
        }
    }
}

async function aggregateAndFinalizeVotes(
    proposalId: bigint,
    contracts: ContractInstances
) {
    try {
        console.log(chalk.blue(`🔍 Aggregating votes for proposal ${proposalId}`));

        // Fetch proposals from both chains
        const [bscProposal, arbProposal] = await Promise.all([
            contracts.GovernanceBSC.proposals(proposalId),
            contracts.GovernanceARB.proposals(proposalId)
        ]);

        // Aggregate votes
        const totalYesVotes = bscProposal.yesVotes + arbProposal.yesVotes;
        const totalNoVotes = bscProposal.noVotes + arbProposal.noVotes;

        console.log(chalk.blue(`📊 Vote totals - Yes: ${totalYesVotes}, No: ${totalNoVotes}`));

        // Finalize vote tally on both chains
        const bscFinalize = await contracts.BscContractSigner.finalizeVoteTally(
            proposalId,
            totalYesVotes,
            totalNoVotes
        );
        await bscFinalize.wait();

        const arbFinalize = await contracts.ArbContractSigner.finalizeVoteTally(
            proposalId,
            totalYesVotes,
            totalNoVotes
        );
        await arbFinalize.wait();

        console.log(chalk.green(`✅ Vote tallies finalized on both chains`));

        return { totalYesVotes, totalNoVotes };
    } catch (error) {
        console.error(chalk.red(`❌ Error aggregating votes:`, error));
        throw error;
    }
}

async function executeProposal(
    proposalId: bigint,
    contracts: ContractInstances
) {
    try {
        console.log(chalk.blue(`🔄 Executing proposal ${proposalId}`));

        // Execute on BSC
        const bscExecution = await contracts.BscContractSigner.executeProposal(proposalId);
        await bscExecution.wait();
        console.log(chalk.green(`✅ Proposal executed on BSC`));

        // Execute on ARB
        const arbExecution = await contracts.ArbContractSigner.executeProposal(proposalId);
        await arbExecution.wait();
        console.log(chalk.green(`✅ Proposal executed on ARB`));

    } catch (error) {
        console.error(chalk.red(`❌ Error executing proposal:`, error));
        throw error;
    }
}

async function syncProposals(contracts: ContractInstances) {
    const bscProposalCount = BigInt(await contracts.GovernanceBSC.proposalCount());
    const arbProposalCount = BigInt(await contracts.GovernanceARB.proposalCount());

    console.log(chalk.blue(`🔄 Syncing proposals: BSC(${bscProposalCount}) ↔ ARB(${arbProposalCount})`));

    // Sync BSC -> ARB
    if (bscProposalCount > arbProposalCount) {
        console.log(chalk.yellow(`⚠️ Missing proposals detected on ARB. Relaying...`));
        for (let i = arbProposalCount + 1n; i <= bscProposalCount; i++) {
            const proposal = await contracts.GovernanceBSC.proposals(i);
            await relayProposalWithRetry(
                i,
                proposal.title,
                proposal.description,
                proposal.startTime,
                proposal.endTime,
                contracts.ArbContractSigner
            );
        }
    }

    // Sync ARB -> BSC
    if (arbProposalCount > bscProposalCount) {
        console.log(chalk.yellow(`⚠️ Missing proposals detected on BSC. Relaying...`));
        for (let i = bscProposalCount + 1n; i <= arbProposalCount; i++) {
            const proposal = await contracts.GovernanceARB.proposals(i);
            await relayProposalWithRetry(
                i,
                proposal.title,
                proposal.description,
                proposal.startTime,
                proposal.endTime,
                contracts.BscContractSigner
            );
        }
    }

    console.log(chalk.green(`✅ Proposal sync complete.`));
}

async function checkAndProcessCompletedProposals(contracts: ContractInstances) {
    try {
        const proposalCount = await contracts.GovernanceBSC.proposalCount();
        
        for (let id = 1n; id <= proposalCount; id++) {
            const proposal = await contracts.GovernanceBSC.proposals(id);
            
            // Check if voting period has ended and proposal is still pending
            if (BigInt(proposal.endTime) <= BigInt(Math.floor(Date.now() / 1000)) && 
                proposal.status === 0 && // 0 = Pending
                !proposal.voteTallyFinalized) {
                
                console.log(chalk.yellow(`📝 Processing completed proposal ${id}`));
                
                // Aggregate and finalize votes
                await aggregateAndFinalizeVotes(id, contracts);

                // Execute proposal
                await executeProposal(id, contracts);
            }
        }
    } catch (error) {
        console.error(chalk.red(`❌ Error processing completed proposals:`, error));
    }
}

async function pollEvents(contracts: ContractInstances) {
    try {
        // Poll BSC -> ARB
        const bscLogs = await contracts.bscProvider.getLogs({
            address: CONFIG.BSC.CONTRACT,
            fromBlock: "latest",
            topics: [ethers.id("ProposalCreated(uint256,string,string,uint256,uint256)")]
        });

        for (const log of bscLogs) {
            if (!log.data || log.data === "0x") continue;

            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ["string", "string", "uint256", "uint256"],
                log.data
            );

            const proposalId = BigInt(log.topics[1]);
            const title = decoded[0];
            const description = decoded[1];
            const startTime = BigInt(decoded[2]);
            const endTime = BigInt(decoded[3]);

            console.log(chalk.blue(`📢 New proposal detected on BSC: ${chalk.green(title)}`));

            await relayProposalWithRetry(
                proposalId,
                title,
                description,
                startTime,
                endTime,
                contracts.ArbContractSigner
            );
        }

        // Poll ARB -> BSC
        const arbLogs = await contracts.arbProvider.getLogs({
            address: CONFIG.ARB.CONTRACT,
            fromBlock: "latest",
            topics: [ethers.id("ProposalCreated(uint256,string,string,uint256,uint256)")]
        });

        for (const log of arbLogs) {
            if (!log.data || log.data === "0x") continue;

            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ["string", "string", "uint256", "uint256"],
                log.data
            );

            const proposalId = BigInt(log.topics[1]);
            const title = decoded[0];
            const description = decoded[1];
            const startTime = BigInt(decoded[2]);
            const endTime = BigInt(decoded[3]);

            console.log(chalk.blue(`📢 New proposal detected on ARB: ${chalk.green(title)}`));

            await relayProposalWithRetry(
                proposalId,
                title,
                description,
                startTime,
                endTime,
                contracts.BscContractSigner
            );
        }
    } catch (error) {
        console.error(chalk.red(`❌ Error while polling events:`, error));
    }
}

async function main() {
    try {
        // Initialize all contract instances
        const contracts = await initializeContracts();

        console.log(chalk.green("🔄 Running initial proposal sync..."));
        await syncProposals(contracts);
        
        // Set up polling intervals
        setInterval(() => pollEvents(contracts), 15000); // Poll for new proposals every 15 seconds
        setInterval(() => checkAndProcessCompletedProposals(contracts), 60000); // Check completed proposals every minute

        console.log(chalk.green("🚀 Relayer started successfully"));
        
    } catch (error) {
        console.error(chalk.red("❌ Error starting relayer:", error));
        process.exit(1);
    }
}

// Start the relayer
main().catch((error) => {
    console.error(chalk.red("❌ Fatal error:", error));
    process.exit(1);
});