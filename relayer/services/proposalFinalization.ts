import { MainGovernance } from "../contracts/mainGov";

export async function finalizeProposalIfVotesCollected(
    mainGovernance: MainGovernance,
    proposalId: string,
    endTime: number
) {
    const currentTime = Math.floor(Date.now() / 1000);

    if (currentTime < endTime) {
        console.log(`⏩ Proposal ${proposalId} voting still active.`);
        return;
    }

    const proposal = await mainGovernance.getProposalDetails(proposalId);

    if (proposal.voteTallyFinalized) {
        console.log(`⏩ Proposal ${proposalId} already finalized.`);
        return;
    }

    const registeredChains = await mainGovernance.getRegisteredChains();
    for (const chainId of registeredChains) {
        const votes = await mainGovernance.getSecondaryChainVotes(proposalId, chainId);
        if (!votes.collected) {
            console.log(`⏩ Proposal ${proposalId}: votes not collected yet from ${chainId}`);
            return;
        }
    }

    try {
        await mainGovernance.finalizeProposalVotes(proposalId);
        console.log(`✅ Finalized proposal ${proposalId}`);
    } catch (error) {
        console.error(`❌ Error finalizing proposal ${proposalId}:`, error);
    }
}
