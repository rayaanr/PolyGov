import { useWriteContract, useChainId, useSwitchChain, useAccount } from "wagmi";
import { useCallback } from "react";
import { toast } from "sonner";
import { MAIN_CONFIG } from "@/constants/config";
import { EXECUTE_PROPOSAL_KEY } from "@/constants/keys";
import { type Hash } from "viem";

export function useExecuteProposal() {
    const { writeContractAsync, isPending, error, reset } = useWriteContract();
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();
    const { isConnected } = useAccount();

    const executeProposal = useCallback(
        async (id: string): Promise<Hash> => {
            if (!id) throw new Error("Proposal ID required");

            try {
                if (isConnected && chainId !== MAIN_CONFIG.chainId) {
                    toast.info("Switching to the required network...");
                    await switchChainAsync({ chainId: MAIN_CONFIG.chainId });
                }

                // Based on the ABI, executeProposal only requires the proposalId
                const hash = await writeContractAsync({
                    address: MAIN_CONFIG.contracts.governance,
                    abi: MAIN_CONFIG.abi.governance,
                    functionName: EXECUTE_PROPOSAL_KEY,
                    args: [id],
                    chainId: MAIN_CONFIG.chainId,
                });

                reset();
                toast.success("Proposal executed successfully!", {
                    action: {
                        label: "View on Explorer",
                        onClick: () => {
                            window.open(`${MAIN_CONFIG.explorerUrl}/tx/${hash}`, "_blank");
                        },
                    },
                });
                return hash;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Unknown error";
                toast.error("Execution failed", { description: msg });
                throw err;
            }
        },
        [writeContractAsync, reset]
    );

    return { executeProposal, isPending, error, reset };
}
