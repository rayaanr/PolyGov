"use client";

import { useState } from "react";
import { useVoteOnProposal } from "@/hooks/useVoteOnProposal";
import { toast } from "sonner";

export default function VoteOnProposal({ proposalId }: { proposalId: string }) {
    const [support, setSupport] = useState<boolean | null>(null);

    const { voteOnProposal, isPending, isSuccess, error } = useVoteOnProposal();

    const handleVote = async (e: React.FormEvent) => {
        e.preventDefault();

        if (support === null) {
            toast.info("Please select a vote option.");
            return;
        }

        try {
            await voteOnProposal(proposalId, support);
            setSupport(null); // Reset the vote selection
        } catch (err) {
            toast.error("Failed to vote on proposal.", {
                description: err instanceof Error ? err.message : "Unknown error occurred",
            });
        }
    };

    return (
        <div>
            <h2>Vote on Proposal #{proposalId}</h2>
            <form onSubmit={handleVote}>
                <div>
                    <label>
                        <input
                            type="radio"
                            name="vote"
                            value="yes"
                            checked={support === true}
                            onChange={() => setSupport(true)}
                        />
                        Yes
                    </label>
                </div>
                <div>
                    <label>
                        <input
                            type="radio"
                            name="vote"
                            value="no"
                            checked={support === false}
                            onChange={() => setSupport(false)}
                        />
                        No
                    </label>
                </div>
                <button type="submit" disabled={isPending}>
                    {isPending ? "Submitting Vote..." : "Submit Vote"}
                </button>
            </form>

            {isSuccess && <p style={{ color: "green" }}>Vote submitted successfully!</p>}
            {error && <p style={{ color: "red" }}>Error: {error.message}</p>}
        </div>
    );
}
