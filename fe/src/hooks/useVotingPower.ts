import { useChainId, useReadContract, useAccount } from "wagmi";
import { USER_VOTE_POWER_KEY } from "@/constants/keys";
import { type Address } from "viem";
import { SUPPORTED_CHAINS } from "./useVoteOnProposal";

export function useVotingPower(proposalId: string) {
    const chainId = useChainId();
    const { address } = useAccount();

    if (!proposalId) throw new Error("Proposal ID required");

    const config =
        SUPPORTED_CHAINS[chainId] ??
        (() => {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        })();

    const { data, isLoading, isError, error } = useReadContract({
        address: config.config.contracts.governance as Address,
        abi: config.config.abi.governance,
        functionName: USER_VOTE_POWER_KEY,
        args: address ? [proposalId, address] : undefined,
        chainId: config.chain.id,
    });

    return {
        votingPower: data as bigint | undefined,
        isLoading,
        isError,
        error,
    };
}
