import {
    useWriteContract,
    useWaitForTransactionReceipt,
    useSwitchChain,
    useAccount,
    useChainId,
} from "wagmi";
import { useState } from "react";
import { toast } from "sonner";
import { MAIN_CONFIG } from "@/constants/config";
import { CREATE_PROPOSAL_KEY } from "@/constants/keys";

export function useCreateProposal() {
    const { writeContractAsync, isPending, error, reset } = useWriteContract();
    const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
    const [isSuccess, setIsSuccess] = useState(false);

    // Add chain-related hooks
    const { switchChainAsync } = useSwitchChain();
    const { isConnected } = useAccount();
    const currentChainId = useChainId();

    // Move the hook to the top level
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    });

    const createProposal = async (
        title: string,
        description: string,
        durationMins: string,
        target: string,
        calldata: string
    ) => {
        if (!title || !description || !durationMins || !target || !calldata) {
            throw new Error("Please fill in all fields.");
        }

        try {
            // Check if user is on the correct chain, if not, switch automatically
            if (isConnected && currentChainId !== MAIN_CONFIG.chainId) {
                toast.info("Switching to the required network...");
                await switchChainAsync({ chainId: MAIN_CONFIG.chainId });
            }

            // Use writeContractAsync to properly await the transaction
            const txHash = await writeContractAsync({
                address: MAIN_CONFIG.contracts.governance,
                abi: MAIN_CONFIG.abi.governance,
                functionName: CREATE_PROPOSAL_KEY,
                args: [title, description, BigInt(durationMins), [target], [BigInt(0)], [calldata]],
                chainId: MAIN_CONFIG.chainId,
            });

            // Set the hash to trigger the useWaitForTransactionReceipt hook
            setHash(txHash);
        } catch (err) {
            errorHandler(err);
        }
    };

    // Effect to handle successful confirmation
    // React to isConfirmed state change
    if (isConfirmed && hash && !isSuccess) {
        setIsSuccess(true);
        reset();
        toast.success("Proposal created successfully!", {
            action: {
                label: "View on Explorer",
                onClick: () => {
                    window.open(`${MAIN_CONFIG.explorerUrl}/tx/${hash}`, "_blank");
                },
            },
        });
        setHash(undefined); // Reset hash after success
        setIsSuccess(false); // Reset success state after success
        reset(); // Reset the transaction state
    }

    return {
        createProposal,
        isPending,
        isConfirming,
        isSuccess,
        error,
        reset: () => {
            setHash(undefined);
            setIsSuccess(false);
            reset();
        },
    };
}

// Error handler function
const errorHandler = (error: unknown) => {
    if (error instanceof Error) {
        switch (error.message) {
            case "User rejected transaction":
                toast.error("Transaction rejected", {
                    description: "User rejected the transaction",
                });
                break;
            case "Invalid parameters":
                toast.error("Invalid parameters", {
                    description: "Please check your input values",
                });
                break;
            default:
                toast.error("Unknown error occurred", {
                    description: error.message,
                });
        }
    }
};
