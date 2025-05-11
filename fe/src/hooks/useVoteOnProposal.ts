import { useWriteContract, useChainId } from "wagmi";
import { bscTestnet, arbitrumSepolia, type Chain } from "wagmi/chains";
import { useCallback } from "react";
import { toast } from "sonner";
import CONFIG, { MAIN_CONFIG } from "@/constants/config";
import { VOTE_KEY } from "@/constants/keys";
import { type Address, type Hash } from "viem";

export const SUPPORTED_CHAINS: Record<number, { chain: Chain; config: any }> = {
    [bscTestnet.id]: { chain: bscTestnet, config: CONFIG.SECONDARY_CHAINS[0] },
    [arbitrumSepolia.id]: { chain: arbitrumSepolia, config: MAIN_CONFIG },
};

export function useVoteOnProposal() {
    const { writeContractAsync, isPending, error, reset } = useWriteContract();
    const chainId = useChainId();

    const getChainConfig = useCallback(() => {
        const config = SUPPORTED_CHAINS[chainId];
        if (!config) throw new Error(`Unsupported chain ID: ${chainId}`);
        return config;
    }, [chainId]);

    const voteOnProposal = useCallback(
        async (id: string, support: boolean): Promise<Hash> => {
            if (!id) throw new Error("Proposal ID required");

            try {
                const { chain, config } = getChainConfig();
                const hash = await writeContractAsync({
                    address: config.contracts.governance as Address,
                    abi: config.abi.governance,
                    functionName: VOTE_KEY,
                    args: [id, support],
                    chain,
                });

                reset();
                toast.success("Vote cast successfully!", {
                    action: {
                        label: "View on Explorer",
                        onClick: () => {
                            window.open(`${config.explorerUrl}/tx/${hash}`, "_blank");
                        },
                    },
                });
                return hash;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Unknown error";
                toast.error("Vote failed", { description: msg });
                throw err;
            }
        },
        [writeContractAsync, reset, getChainConfig]
    );

    return { voteOnProposal, isPending, error, reset };
}
