"use client";

import { useWriteContract } from "wagmi";
import { GovernanceBSCABI } from "@/constants/abi/BSCGovABI";
import { CONTRACTS } from "@/constants/contracts";
import { bscTestnet } from "wagmi/chains";
import { useState } from "react";
import { toast } from "sonner";

export function useVoteOnProposal() {
    const { writeContract, isPending, error, reset } = useWriteContract();
    const [isSuccess, setIsSuccess] = useState(false);

    const voteOnProposal = async (proposalId: string, support: boolean) => {
        if (!proposalId) {
            throw new Error("Proposal ID is required.");
        }

        try {
            writeContract({
                address: CONTRACTS.bscTestnet.governanceContract,
                abi: GovernanceBSCABI,
                functionName: "vote",
                args: [BigInt(proposalId), support],
                chainId: bscTestnet.id,
            });

            setIsSuccess(true);
            reset(); // Reset the hook state after a successful transaction
            toast.success("Vote submitted successfully!");
        } catch (err) {
            toast.error("Failed to vote on proposal.", {
                description: err instanceof Error ? err.message : "Unknown error occurred",
            });
            throw err; // Re-throw the error for the caller to handle
        }
    };

    return {
        voteOnProposal,
        isPending,
        isSuccess,
        error,
        reset: () => {
            setIsSuccess(false);
            reset();
        },
    };
}
