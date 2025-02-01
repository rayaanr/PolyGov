"use client";

import { useWriteContract } from "wagmi";
import { GovernanceBSCABI } from "@/constants/abi/BSCGovABI";
import { CONTRACTS } from "@/constants/contracts";
import { bscTestnet } from "wagmi/chains";
import { useState } from "react";
import { toast } from "sonner";

export function useCreateProposal() {
    const { writeContractAsync, isPending, error, reset } = useWriteContract();
    const [isSuccess, setIsSuccess] = useState(false);

    const createProposal = async (title: string, description: string, durationDays: string) => {
        if (!title || !description || !durationDays) {
            throw new Error("Please fill in all fields.");
        }

        try {
            // Use writeContractAsync to properly await the transaction
            await writeContractAsync({
                address: CONTRACTS.bscTestnet.governanceContract,
                abi: GovernanceBSCABI,
                functionName: "createProposal",
                args: [title, description, BigInt(durationDays)],
                chainId: bscTestnet.id,
            });

            setIsSuccess(true);
            reset(); // Reset the hook state after a successful transaction
            toast.success("Proposal created successfully!");
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
