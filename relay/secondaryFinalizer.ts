import { JsonRpcProvider, Contract } from "ethers";
import { CONFIG, MAIN_GOVERNANCE_ABI, SECONDARY_GOVERNANCE_ABI, wallet } from "./config";

export const startSecondaryFinalizer = async () => {
    const mainProvider = new JsonRpcProvider(CONFIG.MAIN.RPC_URL);
    const mainSigner = wallet.connect(mainProvider);
    const mainContract = new Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

    console.log("⏳ Secondary finalizer started...");

    setInterval(async () => {
        try {
            const proposalIds: string[] = await mainContract.getProposalIds();
            const now = Math.floor(Date.now() / 1000);

            for (const id of proposalIds) {
                const proposal = await mainContract.getProposalDetails(id);

                if (now < Number(proposal.endTime)) continue;

                for (const chain of CONFIG.SECONDARY_CHAINS) {
                    try {
                        const provider = new JsonRpcProvider(chain.RPC_URL);
                        const signer = wallet.connect(provider);
                        const secondary = new Contract(
                            chain.CONTRACT,
                            SECONDARY_GOVERNANCE_ABI,
                            signer
                        );

                        const secondaryProposal = await secondary.getProposalDetails(id);
                        if (
                            !secondaryProposal.voteFinalized &&
                            now >= Number(secondaryProposal.endTime)
                        ) {
                            console.log(`🔧 Finalizing on ${chain.CHAIN_ID}: ${id}`);
                            const tx = await secondary.finalizeVotes(id);
                            await tx.wait();
                            console.log(`✅ Finalized on ${chain.CHAIN_ID}`);
                        }
                    } catch (err) {
                        console.warn(
                            `⚠️  Secondary finalization failed on ${chain.CHAIN_ID} for ${id}:`,
                            err
                        );
                    }
                }
            }
        } catch (err) {
            console.error("❌ Secondary finalizer loop error:", err);
        }
    }, 30_000);
};
