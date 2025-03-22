import CONFIG, { MAIN_CONFIG } from "@/constants/config";
import useChainProposalDetails from "./useChainProposalDetails";
import { CombinedProposal, SecondaryProposal } from "@/lib/types";
import { isProposalDetails, isSecondaryProposalDetails } from "./useProposals";

const useProposalById = (proposalId: string) => {
    const {
        proposals: mainProposals,
        isLoading: isLoadingMain,
        error: mainError,
    } = useChainProposalDetails(MAIN_CONFIG, [proposalId]);

    const secondaryChains = CONFIG.SECONDARY_CHAINS.map((chain) => ({
        ...useChainProposalDetails(chain, [proposalId]),
        chainName: chain.name,
        chainId: chain.chainId,
    }));

    // Loading state: true if any chain is still loading
    const isLoading = isLoadingMain || secondaryChains.some((chain) => chain.isLoading);

    // Error state: collect all errors
    const errors: (Error | null)[] = [
        mainError,
        ...secondaryChains.map((chain) => chain.error),
    ].filter((e): e is Error => e !== null);

    // If still loading, return loading state
    if (isLoading) {
        return {
            proposal: null,
            isLoading: true,
            error: null,
        };
    }

    // If there are any errors, return first error
    if (errors.length > 0) {
        return {
            proposal: null,
            isLoading: false,
            error: errors[0],
        };
    }

    // Process main proposal
    const mainProposal = mainProposals[0];
    if (!mainProposal || !isProposalDetails(mainProposal)) {
        return {
            proposal: null,
            isLoading: false,
            error: new Error("Invalid main proposal details"),
        };
    }

    // Process secondary proposals
    const secondaryProposals: SecondaryProposal[] = [];
    for (const chain of secondaryChains) {
        const proposal = chain.proposals[0];
        if (proposal && isSecondaryProposalDetails(proposal)) {
            secondaryProposals.push({
                chainName: chain.chainName,
                proposal: proposal,
            });
        }
    }

    const combinedProposal: CombinedProposal = {
        id: proposalId,
        mainProposal,
        secondaryProposals,
    };

    return {
        proposal: combinedProposal,
        isLoading: false,
        error: null,
    };
};

export default useProposalById;
