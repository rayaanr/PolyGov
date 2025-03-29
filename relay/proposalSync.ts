import { ethers, JsonRpcProvider } from "ethers";
import { CONFIG, MAIN_GOVERNANCE_ABI, SECONDARY_GOVERNANCE_ABI, wallet } from "./config";

export const runProposalIdSync = async () => {
    const mainProvider = new JsonRpcProvider(CONFIG.MAIN.RPC_URL);
    const mainSigner = wallet.connect(mainProvider);
    const mainContract = new ethers.Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);

    const proposalIds: string[] = await mainContract.getProposalIds();
    const now = Math.floor(Date.now() / 1000);

    const proposals: any[] = [];
    for (const id of proposalIds) {
        const p = await mainContract.getProposalDetails(id);
        proposals.push(p);
    }

    for (const chain of CONFIG.SECONDARY_CHAINS) {
        console.log(`\n🔍 Checking proposals on ${chain.CHAIN_ID}`);

        const provider = new JsonRpcProvider(chain.RPC_URL);
        const signer = wallet.connect(provider);
        const secondary = new ethers.Contract(chain.CONTRACT, SECONDARY_GOVERNANCE_ABI, signer);

        const secondaryIds: string[] = await secondary.getProposalIds();
        const secondarySet = new Set(secondaryIds.map((id) => id.toLowerCase()));

        for (const proposal of proposals) {
            const id = proposal.id.toLowerCase();

            if (!secondarySet.has(id)) {
                console.log(`⛔ Proposal ${id} missing on ${chain.CHAIN_ID}, mirroring...`);
                try {
                    const tx = await secondary.mirrorProposal(
                        proposal.id,
                        proposal.title,
                        proposal.ipfsHash,
                        proposal.startTime,
                        proposal.endTime,
                        proposal.proposer
                    );
                    await tx.wait();
                    console.log(`✅ Mirrored proposal ${id} to ${chain.CHAIN_ID}`);
                } catch (err) {
                    console.error(`❌ Failed to mirror proposal ${id}:`, err);
                    continue;
                }
            }

            // Re-fetch proposal from secondary
            let secondaryProposal: any;
            try {
                secondaryProposal = await secondary.getProposalDetails(proposal.id);
            } catch (err) {
                console.error(`❌ Couldn't fetch proposal ${id} from ${chain.CHAIN_ID}:`, err);
                continue;
            }

            const votingEnded = now >= Number(secondaryProposal.endTime);

            if (!secondaryProposal.voteFinalized && votingEnded) {
                console.log(`🕓 Voting ended on ${chain.CHAIN_ID}, finalizing ${id}...`);
                try {
                    const tx = await secondary.finalizeVotes(proposal.id);
                    await tx.wait();
                    console.log(`✅ Finalized votes on ${chain.CHAIN_ID}`);
                } catch (err) {
                    console.warn(`⚠️ Failed to finalize on ${chain.CHAIN_ID}:`, err);
                    continue;
                }
            }

            // Attempt to collect votes on main if not collected
            const summary = await mainContract.secondaryChainVotes(proposal.id, chain.CHAIN_ID);
            if (!summary.collected && secondaryProposal.voteFinalized) {
                try {
                    console.log(`📬 Submitting votes to MAIN from ${chain.CHAIN_ID}...`);
                    const tx = await mainContract.collectSecondaryChainVotes(
                        proposal.id,
                        chain.CHAIN_ID,
                        secondaryProposal.yesVotes,
                        secondaryProposal.noVotes
                    );
                    await tx.wait();
                    console.log(`✅ Collected secondary votes on MAIN`);
                } catch (err) {
                    console.warn(`❌ Failed to collect votes on MAIN:`, err);
                }
            }
        }
    }

    console.log("\n✅ Proposal sync and repair complete.\n");
};
