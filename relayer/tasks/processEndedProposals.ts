import { MainGovernance } from "../contracts/mainGov";
import { SecondaryGovernance } from "../contracts/secondaryGov";
import { ContractConnections } from "../types";
import { finalizeProposalIfVotesCollected } from "../services/proposalFinalization";
import { collectVotesFromSecondary, isVoteCollected } from "../services/voteCollection";
import { loadProposalCache } from "../utils/cache"; 
import { decodeCustomError } from "../utils/decodeCustomError";
import { MAIN_GOVERNANCE_ABI, SECONDARY_GOVERNANCE_ABI } from "../config";

export async function processEndedProposals(
    mainGov: MainGovernance,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🔍 Processing proposals with ended voting...");

    const cache = loadProposalCache();
    const finalizedIds = new Set(cache.finalized.map((p) => p.id));

    try {
        const proposalIds = await mainGov.getProposalIds();
        const currentTime = Math.floor(Date.now() / 1000);

        for (const proposalId of proposalIds) {
            // ✅ Skip if already finalized (locally tracked)
            if (finalizedIds.has(proposalId.toString())) {
                console.log(`⏩ Skipping already finalized proposal ${proposalId}`);
                continue;
            }

            const mainProposal = await mainGov.getProposalDetails(proposalId);

            if (Number(mainProposal.endTime) > currentTime || mainProposal.voteTallyFinalized) {
                continue; // Voting still active or already finalized on-chain
            }

            for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                const secondaryGov = new SecondaryGovernance(contract);

                try {
                    const secondaryProposal = await secondaryGov.getProposalDetails(proposalId);

                    // Finalize secondary chain votes if expired
                    if (
                        !secondaryProposal.voteFinalized &&
                        Number(secondaryProposal.endTime) <= currentTime
                    ) {
                        console.log(`🗳️ Finalizing votes on ${chainId} for proposal ${proposalId}`);
                        await secondaryGov.finalizeVotes(proposalId);
                    }

                    // Collect votes if finalized but not yet collected
                    const votesCollected = await isVoteCollected(mainGov, chainId, proposalId);

                    if (!votesCollected && secondaryProposal.voteFinalized) {
                        console.log(`📊 Collecting votes from ${chainId} for proposal ${proposalId}`);
                        await collectVotesFromSecondary(
                            mainGov,
                            proposalId,
                            chainId,
                            secondaryProposal.yesVotes,
                            secondaryProposal.noVotes
                        );
                    }
                } catch (error: any) {
                    const rawData = error?.error?.data || error?.data;
                    const decodedError = rawData ? decodeCustomError(rawData, SECONDARY_GOVERNANCE_ABI) : null;

                    if (decodedError) {
                        console.error(`❌ Custom Error while processing proposal ${proposalId} on ${chainId}: ${decodedError}`);
                    } else {
                        console.error(`❌ Unknown error processing proposal ${proposalId} on ${chainId}`);
                    }
                }
            }

            // Try finalizing on main chain if ready
            try {
                await finalizeProposalIfVotesCollected(
                    mainGov,
                    proposalId,
                    Number(mainProposal.endTime)
                );
            } catch (error: any) {
                const rawData = error?.error?.data || error?.data;
                const decodedError = rawData ? decodeCustomError(rawData, MAIN_GOVERNANCE_ABI) : null;

                if (decodedError) {
                    console.error(`❌ Custom Error finalizing proposal ${proposalId} on main chain: ${decodedError}`);
                } else {
                    console.error(`❌ Unknown error finalizing proposal ${proposalId} on main chain:`, error);
                }
            }
        }
    } catch (error) {
        console.error("❌ Error processing ended proposals:", error);
    }
}
