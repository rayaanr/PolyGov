import { MainGovernance } from "../contracts/mainGov";
import { SecondaryGovernance } from "../contracts/secondaryGov";
import { finalizeProposalIfVotesCollected } from "../services/proposalFinalization";
import { collectVotesFromSecondary, isVoteCollected } from "../services/voteCollection";
import { ContractConnections } from "../types";

export function setupSecondaryChainListeners(
    mainGov: MainGovernance,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🎧 Setting up Secondary Chain event listeners...");

    for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
        contract.on("VotesTallied", async (proposalId: string) => {
            console.log(`🗳️ Votes tallied for proposal ${proposalId} on ${chainId}`);
            const secondaryGov = new SecondaryGovernance(contract);

            try {
                const secondaryProposal = await secondaryGov.getProposalDetails(proposalId);

                await collectVotesFromSecondary(
                    mainGov,
                    proposalId,
                    chainId,
                    secondaryProposal.yesVotes,
                    secondaryProposal.noVotes
                );

                if (await isVoteCollected(mainGov, chainId, proposalId)) {
                    // Wait a little to ensure cross-chain updates are reflected
                    await new Promise((resolve) => setTimeout(resolve, 5000));

                    const mainProposal = await mainGov.getProposalDetails(proposalId);

                    if (!mainProposal.voteTallyFinalized) {
                        await finalizeProposalIfVotesCollected(
                            mainGov,
                            proposalId,
                            Number(mainProposal.endTime)
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
