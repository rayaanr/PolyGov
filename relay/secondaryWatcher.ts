import { WebSocketProvider, Contract } from "ethers";
import { CONFIG, MAIN_GOVERNANCE_ABI, SECONDARY_GOVERNANCE_ABI, wallet } from "./config";

export const startSecondaryWatchers = async () => {
    const mainProvider = new WebSocketProvider(CONFIG.MAIN.WS_URL);
    const mainSigner = wallet.connect(mainProvider);

    const mainContract = new Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

    console.log(`\n[Relayer] Listening for VotesTallied on all secondary chains...`);

    for (const chain of CONFIG.SECONDARY_CHAINS) {
        const provider = new WebSocketProvider(chain.WS_URL);
        const signer = wallet.connect(provider);
        const secondaryContract = new Contract(
            chain.CONTRACT,
            SECONDARY_GOVERNANCE_ABI,
            signer
        );

        secondaryContract.on("VotesTallied", async (proposalId, yesVotes, noVotes) => {
            console.log(`📬 [${chain.CHAIN_ID}] VotesTallied for ${proposalId}`);
            try {
                const tx = await mainContract.collectSecondaryChainVotes(
                    proposalId,
                    chain.CHAIN_ID,
                    yesVotes,
                    noVotes
                );
                await tx.wait();
                console.log(`✅ Collected votes from ${chain.CHAIN_ID} -> Main: ${tx.hash}`);
            } catch (err) {
                console.error(`❌ Error submitting votes to Main from ${chain.CHAIN_ID}:`, err);
            }
        });
    }
};
