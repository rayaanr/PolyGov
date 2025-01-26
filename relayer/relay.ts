import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

const CONFIG = {
    BSC: {
        RPC: process.env.BSC_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545",
        CONTRACT: process.env.BSC_CONTRACT!,
    },
    ARB: {
        RPC: process.env.ARB_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
        CONTRACT: process.env.ARB_CONTRACT!,
    },
};

async function main() {
    // Setup providers and signer
    const bscProvider = new ethers.JsonRpcProvider(CONFIG.BSC.RPC);
    const arbProvider = new ethers.JsonRpcProvider(CONFIG.ARB.RPC);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, arbProvider);

    // Load contracts with any types
    const GovernanceBSC: any = new ethers.Contract(
        CONFIG.BSC.CONTRACT,
        ["event ProposalCreated(uint256 indexed id, string description)"],
        bscProvider
    );

    const GovernanceARB: any = new ethers.Contract(
        CONFIG.ARB.CONTRACT,
        ["function createProposal(uint256 _id, string _description)"],
        signer
    );

    // Event listener with any types
    GovernanceBSC.on("ProposalCreated", async (id: any, description: any) => {
        try {
            console.log(`New proposal: #${id} - ${description}`);

            // Relay proposal
            const tx = await GovernanceARB.createProposal(id, description);
            console.log(`Relaying... TX hash: ${tx.hash}`);

            await tx.wait();
            console.log(`Proposal ${id} relayed successfully!`);
        } catch (error) {
            console.error(`Error relaying proposal ${id}:`, error);
        }
    });

    console.log("Relayer started. Listening for BSC proposals...");
}

// Run the relayer
main().catch((error) => {
    console.error("Relayer crashed:", error);
    process.exit(1);
});
