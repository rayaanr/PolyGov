"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import { toast } from "sonner";
import { MAIN_CONFIG } from "@/constants/config";
import { CREATE_PROPOSAL_KEY } from "@/constants/keys";

export function useCreateProposal() {
    const { writeContractAsync, isPending, error, reset } = useWriteContract();
    const [isSuccess, setIsSuccess] = useState(false);

    const createProposal = async (title: string, description: string, durationMins: string) => {
        if (!title || !description || !durationMins) {
            throw new Error("Please fill in all fields.");
        }

        try {
            // Use writeContractAsync to properly await the transaction
            const txHash = await writeContractAsync({
                address: MAIN_CONFIG.contracts.governance,
                abi: MAIN_CONFIG.abi.governance,
                functionName: CREATE_PROPOSAL_KEY,
                args: [title, description, BigInt(durationMins)],
                chainId: MAIN_CONFIG.chainId,
            });

            // Wait for the transaction to be confirmed
            const receipt = useWaitForTransactionReceipt({
                hash: txHash,
            })

            if (!receipt) {
                throw new Error("Transaction receipt not found.");
            }

            setIsSuccess(true);
            reset(); // Reset the hook state after a successful transaction
            toast.success("Proposal created successfully!" + txHash, {
                description: "Your proposal has been created and is pending confirmation.",
            });
        } catch (err) {
            toast.error("Failed to create proposal.", {
                description: err instanceof Error ? err.message : "Unknown error occurred",
            });
            throw err; // Re-throw the error for the caller to handle
        }
    };

    return {
        createProposal,
        isPending,
        isSuccess,
        error,
        reset: () => {
            setIsSuccess(false);
            reset();
        },
    };
}
