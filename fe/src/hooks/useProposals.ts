import CONFIG, { MAIN_CONFIG } from "@/constants/config";
import useChainProposalDetails from "./useChainProposalDetails";
import useProposalIds from "./useProposalIds";
import {
    CombinedProposal,
    ProposalDetails,
    SecondaryProposal,
    SecondaryProposalDetails,
} from "@/lib/types";

// Type guard to check if a proposal is a SecondaryProposalDetails
export function isSecondaryProposalDetails(proposal: any): proposal is SecondaryProposalDetails {
    return proposal && typeof proposal === "object" && "voteTallied" in proposal;
}

// Type guard to check if a proposal is a ProposalDetails
export function isProposalDetails(proposal: any): proposal is ProposalDetails {
    return proposal && typeof proposal === "object" && "voteTallyFinalized" in proposal;
}

// Hook for all proposals
const useProposals = () => {
    const { proposalIds, allIds, isLoading: isLoadingIds, error: idsError } = useProposalIds();

    const {
        proposals: mainProposals,
        isLoading: isLoadingMain,
        error: mainError,
    } = useChainProposalDetails(MAIN_CONFIG, proposalIds);

    const secondaryChains = CONFIG.SECONDARY_CHAINS.map((chain) => ({
        ...useChainProposalDetails(chain, proposalIds),
        chainName: chain.name,
        chainId: chain.chainId,
    }));

    const isLoading = isLoadingIds || isLoadingMain || secondaryChains.some((c) => c.isLoading);
    const error = idsError || mainError || secondaryChains.find((c) => c.error)?.error;

    const combinedProposals: CombinedProposal[] = [];

    for (let index = 0; index < mainProposals.length; index++) {
        const mainProposal = mainProposals[index];
        if (!mainProposal || !isProposalDetails(mainProposal)) continue;

        const id = proposalIds[index];
        const secondaryProposals: SecondaryProposal[] = [];

        for (const chain of secondaryChains) {
            const proposal = chain.proposals[index];
            if (proposal && isSecondaryProposalDetails(proposal)) {
                secondaryProposals.push({
                    chainName: chain.chainName,
                    proposal: proposal,
                });
            }
        }

        combinedProposals.push({
            id,
            mainProposal,
            secondaryProposals,
        });
    }

    return { combinedProposals, isLoading, error, totalCount: allIds.length };
};


export default useProposals;