"use client";

import { useWriteContract, useChainId } from "wagmi";
import { bscTestnet, arbitrumSepolia, type Chain } from "wagmi/chains";
import { useCallback } from "react";
import { toast } from "sonner";
import CONFIG, { MAIN_CONFIG } from "@/constants/config";
import { VOTE_KEY } from "@/constants/keys";
import { type Address, type Hash } from "viem";

// Define supported chains configuration
const SUPPORTED_CHAINS: Record<number, { chain: Chain; config: any }> = {
    [bscTestnet.id]: {
        chain: bscTestnet,
        config: MAIN_CONFIG,
    },
    [arbitrumSepolia.id]: {
        chain: arbitrumSepolia,
        config: CONFIG.SECONDARY_CHAINS[0],
    },
};

export function useVoteOnProposal() {
    const { writeContractAsync, isPending, error, reset } = useWriteContract();
    const chainId = useChainId();

    // Get chain-specific configuration
    const getChainConfig = useCallback(() => {
        const chainConfig = SUPPORTED_CHAINS[chainId];
        if (!chainConfig) {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        }
        return chainConfig;
    }, [chainId]);

    const voteOnProposal = useCallback(
        async (proposalId: string, support: boolean): Promise<Hash> => {
            if (!proposalId) {
                throw new Error("Proposal ID is required");
            }

            try {
                const { chain, config } = getChainConfig();

                const contractConfig = {
                    address: config.contracts.governance as Address,
                    abi: config.abi.governance,
                    functionName: VOTE_KEY,
                    args: [proposalId, support],
                    chain: chain,
                };

                // Use writeContractAsync to get the transaction hash
                const hash = await writeContractAsync(contractConfig);

                reset();
                toast.success("Vote submitted successfully!", {
                    description: `Transaction hash: ${hash}`,
                });

                return hash;
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
                toast.error("Failed to vote on proposal", { description: errorMessage });
                throw err;
            }
        },
        [writeContractAsync, reset, getChainConfig]
    );

    return {
        voteOnProposal,
        isPending,
        error,
        reset: useCallback(() => {
            reset();
        }, [reset]),
    };
}
