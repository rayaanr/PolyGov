import { MAIN_CONFIG } from "@/constants/config";
import { MAX_PROPOSALS } from "@/constants/const";
import { GET_PROPOSAL_IDS_KEY } from "@/constants/keys";
import { ProposalId } from "@/lib/types";
import { useReadContract } from "wagmi";

interface UseProposalIdsResult {
    data: ProposalId[] | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<any>;
}

const useProposalIds = () => {
    const { data, isLoading, error, refetch } = useReadContract({
        address: MAIN_CONFIG.contracts.governance,
        chainId: MAIN_CONFIG.chainId,
        abi: MAIN_CONFIG.abi.governance,
        functionName: GET_PROPOSAL_IDS_KEY,
    }) as UseProposalIdsResult;

    const proposalIds = data?.slice(-MAX_PROPOSALS).reverse() ?? [];
    return { proposalIds, allIds: data ?? [], isLoading, error, refetch };
};

export default useProposalIds;
