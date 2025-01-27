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

async function relayProposalWithRetry(proposalId: any, title: string, description: string, startTime: string, endTime: string, GovernanceARB: ethers.Contract) {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            const tx = await GovernanceARB.mirrorProposal(proposalId, title, description, startTime, endTime);
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

async function main() {
    const bscProvider = new ethers.JsonRpcProvider(CONFIG.BSC.RPC);
    const arbProvider = new ethers.JsonRpcProvider(CONFIG.ARB.RPC);
    const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, arbProvider);

    const GovernanceBSC = new ethers.Contract(
        CONFIG.BSC.CONTRACT,
        [
            "event ProposalCreated(uint256 indexed id, string title, string description, uint256 startTime, uint256 endTime, uint256 snapshotBlock)",
        ],
        bscProvider
    );

    const GovernanceARB = new ethers.Contract(
        CONFIG.ARB.CONTRACT,
        [
            "function mirrorProposal(uint256 _id, string memory _title, string memory _description, uint256 _startTime, uint256 _endTime)",
        ],
        signer
    );

    // Event listener for ProposalCreated
    GovernanceBSC.on(GovernanceBSC.filters.ProposalCreated(), async (log: ethers.EventLog) => {
        const [id, title, description, startTime, endTime] = [
            log.args[0],
            log.args[1],
            log.args[2],
            log.args[3],
            log.args[4],
        ] as [bigint, string, string, bigint, bigint];

        console.log(chalk.blue(`📢 New proposal #${chalk.bold(id)}: ${chalk.green(title)}`));
        await relayProposalWithRetry(id, title, description, startTime.toString(), endTime.toString(), GovernanceARB);
    });

    console.log(chalk.green("🚀 Relayer started. Listening for BSC proposals..."));
}

main().catch((error) => {
    console.error("💥 Relayer crashed:", error);
    process.exit(1);
});
