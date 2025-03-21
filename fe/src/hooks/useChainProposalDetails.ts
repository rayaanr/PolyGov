import { GET_PROPOSAL_DETAILS_KEY } from "@/constants/keys";
import { ChainConfig, ProposalDetails, ProposalId } from "@/lib/types";
import { useReadContracts } from "wagmi";

const useChainProposalDetails = (chainConfig: ChainConfig, proposalIds: ProposalId[]) => {
    const { data, isLoading, error } = useReadContracts({
        contracts: proposalIds.map((id) => ({
            address: chainConfig.contracts.governance,
            chainId: chainConfig.chainId,
            abi: chainConfig.abi.governance,
            functionName: GET_PROPOSAL_DETAILS_KEY,
            args: [id],
        })),
    }) as {
        data: { result: ProposalDetails }[] | undefined;
        isLoading: boolean;
        error: Error | null;
    };

    return {
        proposals: data?.map((d) => d.result) ?? [],
        isLoading,
        error,
    };
};

export default useChainProposalDetails;