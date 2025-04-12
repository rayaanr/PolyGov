import { MainGovernance } from "../contracts/mainGov";
import { finalizeProposalIfVotesCollected } from "../services/proposalFinalization";
import { isVoteCollected } from "../services/voteCollection";
import { ContractConnections } from "../types";


export function setupSecondaryChainListeners(
    mainGov: MainGovernance,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🎧 Setting up Secondary Chain event listeners...");

    for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
        contract.on("VotesTallied", async (proposalId) => {
            console.log(`🗳️ Votes tallied for proposal ${proposalId} on ${chainId}`);
            try {
                if (await isVoteCollected(mainGov, chainId, proposalId)) {
                    const proposal = await mainGov.getProposalDetails(proposalId);
                    if (!proposal.voteTallyFinalized) {
                        await finalizeProposalIfVotesCollected(
                            mainGov,
                            proposalId,
                            Number(proposal.endTime)
                        );
                        console.log(`✅ Proposal ${proposalId} finalized after votes collected.`);
                    }
                }
            } catch (error) {
                console.error(
                    `❌ Error processing VotesTallied for ${proposalId} on ${chainId}:`,
                    error
                );
            }
        });
    }
}
