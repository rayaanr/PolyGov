"use client"

import { useProposals } from "@/hooks/useProposals";

export default function ProposalsList() {
    const { proposals, isLoading } = useProposals();

    if (isLoading) return <p>Loading proposals...</p>;

    return (
        <ul>
            {proposals.map((proposal) => (
                <li key={proposal.id.toString()}>
                    <h3>{proposal.title}</h3>
                    <p>{proposal.description}</p>
                    <p>
                        Votes: Yes ({proposal.yesVotes.toString()}), No (
                        {proposal.noVotes.toString()})
                    </p>
                    <p>Status: {proposal.status}</p>
                </li>
            ))}
        </ul>
    );
}
