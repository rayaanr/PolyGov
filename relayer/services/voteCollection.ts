import { MainGovernance } from "../contracts/mainGov";

export async function isVoteCollected(
    mainGovernance: MainGovernance,
    chainId: string,
    proposalId: string
): Promise<boolean> {
    try {
        const secondaryVotes = await mainGovernance.getSecondaryChainVotes(proposalId, chainId);
        return secondaryVotes.collected;
    } catch (error) {
        console.error(`❌ Error checking vote collection for proposal ${proposalId} on ${chainId}:`, error);
        return false;
    }
}

export async function collectVotesFromSecondary(
    mainGovernance: MainGovernance,
    proposalId: string,
    chainId: string,
    yesVotes: bigint,
    noVotes: bigint
) {
    try {
        await mainGovernance.collectSecondaryChainVotes(proposalId, chainId, yesVotes, noVotes);
        console.log(`✅ Collected votes from ${chainId} for proposal ${proposalId}`);
    } catch (error) {
        console.error(`❌ Error collecting votes from ${chainId} for proposal ${proposalId}:`, error);
    }
}
