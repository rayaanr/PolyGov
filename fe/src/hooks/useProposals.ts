import CONFIG, { MAIN_CONFIG } from "@/constants/config";
import useChainProposalDetails from "./useChainProposalDetails";
import { CombinedProposal, SecondaryProposal } from "@/lib/types";
import useProposalIds from "./useProposalIds";

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

    const combinedProposals = mainProposals
        .map((mainProposal, index) => {
            if (!mainProposal) return null;
            const id = proposalIds[index];
            const secondaryProposals = secondaryChains
                .map((chain) => ({
                    chainName: chain.chainName,
                    proposal: chain.proposals[index],
                }))
                .filter((sp): sp is SecondaryProposal => !!sp.proposal);

            return { id, mainProposal, secondaryProposals };
        })
        .filter((p): p is CombinedProposal => !!p);

    return { combinedProposals, isLoading, error, totalCount: allIds.length };
};

export default useProposals;