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
    return proposal && typeof proposal === "object" && "voteFinalized" in proposal;
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

    // Explicitly call useChainProposalDetails for each secondary chain (assuming 2 chains)
    const secondaryChain1 = CONFIG.SECONDARY_CHAINS[0];
    // const secondaryChain2 = CONFIG.SECONDARY_CHAINS[1];

    const {
        proposals: proposals1,
        isLoading: isLoading1,
        error: error1,
    } = useChainProposalDetails(secondaryChain1, proposalIds);

    // const {
    //     proposals: proposals2,
    //     isLoading: isLoading2,
    //     error: error2,
    // } = useChainProposalDetails(secondaryChain2, proposalIds);

    const secondaryChainResults = [
        {
            proposals: proposals1,
            isLoading: isLoading1,
            error: error1,
            chainName: secondaryChain1.name,
            chainId: secondaryChain1.chainId,
        },
        // {
        //     proposals: proposals2,
        //     isLoading: isLoading2,
        //     error: error2,
        //     chainName: secondaryChain2.name,
        //     chainId: secondaryChain2.chainId,
        // },
    ];

    const isLoading =
        isLoadingIds || isLoadingMain || secondaryChainResults.some((c) => c.isLoading);
    const error = idsError || mainError || secondaryChainResults.find((c) => c.error)?.error;

    const combinedProposals: CombinedProposal[] = [];

    for (let index = 0; index < mainProposals.length; index++) {
        const mainProposal = mainProposals[index];
        if (!mainProposal || !isProposalDetails(mainProposal)) continue;

        const id = proposalIds[index];
        const secondaryProposals: SecondaryProposal[] = [];

        for (const chainResult of secondaryChainResults) {
            const proposal = chainResult.proposals[index];
            if (proposal && isSecondaryProposalDetails(proposal)) {
                secondaryProposals.push({
                    chainName: chainResult.chainName,
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