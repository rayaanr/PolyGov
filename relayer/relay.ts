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

// Full ABI fragment matching the Governance contract structure
const GOVERNANCE_ABI = [
    "function proposalCount() view returns (uint256)",
    "function proposals(uint256) view returns (uint256 id, string title, string description, uint256 yesVotes, uint256 noVotes, uint256 startTime, uint256 endTime, uint8 status)",
    "function mirrorProposal(uint256 id, string title, string description, uint256 startTime, uint256 endTime)"
];

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
            
            // Check if proposal exists by looking at startTime
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
                console.error(`❌ Failed to relay proposal ${chalk.bold(proposalId)} after ${maxAttempts} attempts.`);
            }
        }
    }
}

async function syncProposals() {
    const bscProvider = new ethers.JsonRpcProvider(CONFIG.BSC.RPC);
    const arbProvider = new ethers.JsonRpcProvider(CONFIG.ARB.RPC);
    
    // Initialize signer with both providers for respective chains
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

    const ArbContractSigner = new ethers.Contract(
        CONFIG.ARB.CONTRACT,
        GOVERNANCE_ABI,
        arbSigner
    );

    const BscContractSigner = new ethers.Contract(
        CONFIG.BSC.CONTRACT,
        GOVERNANCE_ABI,
        bscSigner
    );

    const bscProposalCount = BigInt(await GovernanceBSC.proposalCount());
    const arbProposalCount = BigInt(await GovernanceARB.proposalCount());

    console.log(chalk.blue(`🔄 Syncing proposals: BSC(${bscProposalCount}) ↔ ARB(${arbProposalCount})`));

    // Sync BSC -> ARB
    if (bscProposalCount > arbProposalCount) {
        console.log(chalk.yellow(`⚠️ Missing proposals detected on ARB. Relaying...`));
        for (let i = arbProposalCount + 1n; i <= bscProposalCount; i++) {
            const proposal = await GovernanceBSC.proposals(i);
            await relayProposalWithRetry(
                i,
                proposal.title,
                proposal.description,
                proposal.startTime,
                proposal.endTime,
                ArbContractSigner
            );
        }
    }

    // Sync ARB -> BSC
    if (arbProposalCount > bscProposalCount) {
        console.log(chalk.yellow(`⚠️ Missing proposals detected on BSC. Relaying...`));
        for (let i = bscProposalCount + 1n; i <= arbProposalCount; i++) {
            const proposal = await GovernanceARB.proposals(i);
            await relayProposalWithRetry(
                i,
                proposal.title,
                proposal.description,
                proposal.startTime,
                proposal.endTime,
                BscContractSigner
            );
        }
    }

    console.log(chalk.green(`✅ Proposal sync complete.`));
}

async function pollEvents() {
    const bscProvider = new ethers.JsonRpcProvider(CONFIG.BSC.RPC);
    const arbProvider = new ethers.JsonRpcProvider(CONFIG.ARB.RPC);
    
    const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY!);
    const bscSigner = signer.connect(bscProvider);
    const arbSigner = signer.connect(arbProvider);

    console.log(chalk.green("🚀 Relayer started. Polling for proposals on both chains..."));

    // Poll BSC -> ARB
    const monitorBSC = async () => {
        try {
            const bscLogs = await bscProvider.getLogs({
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

                const ArbContractSigner = new ethers.Contract(
                    CONFIG.ARB.CONTRACT,
                    GOVERNANCE_ABI,
                    arbSigner
                );

                await relayProposalWithRetry(
                    proposalId,
                    title,
                    description,
                    startTime,
                    endTime,
                    ArbContractSigner
                );
            }
        } catch (error) {
            console.error(`❌ Error while polling BSC events:`, error);
        }
    };

    // Poll ARB -> BSC
    const monitorARB = async () => {
        try {
            const arbLogs = await arbProvider.getLogs({
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

                const BscContractSigner = new ethers.Contract(
                    CONFIG.BSC.CONTRACT,
                    GOVERNANCE_ABI,
                    bscSigner
                );

                await relayProposalWithRetry(
                    proposalId,
                    title,
                    description,
                    startTime,
                    endTime,
                    BscContractSigner
                );
            }
        } catch (error) {
            console.error(`❌ Error while polling ARB events:`, error);
        }
    };

    // Set up polling intervals
    setInterval(monitorBSC, 15000); // Poll BSC every 15 seconds
    setInterval(monitorARB, 15000); // Poll ARB every 15 seconds
}

async function main() {
    console.log(chalk.green("🔄 Running initial proposal sync..."));
    await syncProposals();
    await pollEvents();
}

main().catch(console.error);