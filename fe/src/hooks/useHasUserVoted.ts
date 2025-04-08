import { useChainId, useReadContract, useAccount } from "wagmi";
import { ALREADY_VOTED_KEY } from "@/constants/keys";
import { type Address } from "viem";
import { SUPPORTED_CHAINS } from "./useVoteOnProposal";

export function useHasUserVoted(proposalId: string) {
    const chainId = useChainId();
    const { address } = useAccount();

    // Input validation
    if (!proposalId) throw new Error("Proposal ID required");

    // Get chain configuration
    const config =
        SUPPORTED_CHAINS[chainId] ??
        (() => {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        })();

    // Execute contract read
    const { data, isLoading, isError, error } = useReadContract({
        address: config.config.contracts.governance as Address,
        abi: config.config.abi.governance,
        functionName: ALREADY_VOTED_KEY,
        args: [proposalId, address] as const,
        chainId: config.chain.id,
    });

    return {
        hasVoted: data as boolean | undefined,
        isLoading,
        isError,
        error,
    };
}
