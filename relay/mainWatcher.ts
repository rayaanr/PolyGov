import { WebSocketProvider, Contract } from "ethers";
import { CONFIG, MAIN_GOVERNANCE_ABI, SECONDARY_GOVERNANCE_ABI, wallet } from "./config";

export const startMainWatcher = async () => {
    const mainProvider = new WebSocketProvider(CONFIG.MAIN.WS_URL);
    const mainSigner = wallet.connect(mainProvider);

    const mainContract = new Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

    console.log(`[Relayer] Listening to ProposalCreated on MAIN chain...`);

    mainContract.on("ProposalCreated", async (proposalId) => {
        console.log(`\n📡 New Proposal Created on Main Chain: ${proposalId}`);
        try {
            const proposal = await mainContract.getProposalDetails(proposalId);

            for (const chain of CONFIG.SECONDARY_CHAINS) {
                const provider = new WebSocketProvider(chain.WS_URL);
                const signer = wallet.connect(provider);
                const secondaryContract = new Contract(
                    chain.CONTRACT,
                    SECONDARY_GOVERNANCE_ABI,
                    signer
                );

                console.log(`↪️  Mirroring to ${chain.CHAIN_ID}...`);

                const tx = await secondaryContract.mirrorProposal(
                    proposal.id,
                    proposal.title,
                    proposal.ipfsHash,
                    proposal.startTime,
                    proposal.endTime,
                    proposal.proposer
                );

                await tx.wait();
                console.log(`✅ Mirrored to ${chain.CHAIN_ID}: ${tx.hash}`);
            }
        } catch (err) {
            console.error(`❌ Error handling ProposalCreated:`, err);
        }
    });
};
