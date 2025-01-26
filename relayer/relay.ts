import { ethers } from "ethers";
import dotenv from "dotenv";
import { CHAINS_INFO } from "../constants/chains";
import { contracts } from "../constants/contracts";

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

async function main() {
    const bscProvider = new ethers.JsonRpcProvider(CONFIG.BSC.RPC);
    const arbProvider = new ethers.JsonRpcProvider(CONFIG.ARB.RPC);
    const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, arbProvider);

    const GovernanceBSC = new ethers.Contract(
        CONFIG.BSC.CONTRACT,
        [
            "event ProposalCreated(uint256 indexed id, string description, uint256 startTime, uint256 endTime)",
        ],
        bscProvider
    );

    const GovernanceARB = new ethers.Contract(
        CONFIG.ARB.CONTRACT,
        [
            "function mirrorProposal(uint256 _id, string _description, uint256 _startTime, uint256 _endTime)",
        ],
        signer
    );

    // Fixed event listener
    GovernanceBSC.on(GovernanceBSC.filters.ProposalCreated(), async (log: ethers.EventLog) => {
        try {
            const [id, description, startTime, endTime] = [
                log.args[0],
                log.args[1],
                log.args[2],
                log.args[3],
            ] as [bigint, string, bigint, bigint];

            console.log(`📢 New proposal #${id}: ${description}`);

            const tx = await GovernanceARB.mirrorProposal(
                id,
                description,
                startTime.toString(),
                endTime.toString()
            );

            console.log(`⏳ Relaying... TX hash: ${tx.hash}`);
            await tx.wait();
            console.log(`✅ Proposal ${id} relayed!`);
        } catch (error) {
            console.error(`❌ Failed to relay proposal:`, error);
        }
    });

    console.log("🚀 Relayer started. Listening for BSC proposals...");
}

main().catch((error) => {
    console.error("💥 Relayer crashed:", error);
    process.exit(1);
});
