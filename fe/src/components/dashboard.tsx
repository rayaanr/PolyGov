"use client";

import { useProposals } from "@/hooks/useProposals";
// import { useState } from "react";
// import { Separator } from "@/components/ui/separator";
import { ProposalList } from "./proposal-list";
// import { mockProposals, mockStats } from "@/lib/mock-data";
// import type { Chain } from "@/lib/types";
// import { StatsGrid } from "./stats-grid";
// import { CreateProposalDialog } from "./create-proposal-dialog";

export default function Dashboard() {
    const { proposals, isLoading, isError } = useProposals();

    if (isLoading) return <p>Loading proposals...</p>;
    if (isError) return <p>Failed to load proposals.</p>;


    // const [selectedChain] = useState<Chain | "all">("all");

    // const filteredProposals =
    //     selectedChain === "all"
    //         ? mockProposals
    //         : mockProposals.filter((p) => p.votesPerChain.some((v) => v.chain === selectedChain));

    return (
        <div className="container mx-auto p-4 space-y-6 mb-44">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">Active Proposals</h2>
                        <p className="text-sm text-muted-foreground">
                            Current governance proposals across all chains
                        </p>
                    </div>
                    {/* <CreateProposalDialog /> */}
                </div>
                {/* <div className="p-6">
            <h2 className="text-xl font-bold">Proposals List</h2>
            {proposals.length === 0 ? (
                <p>No proposals found.</p>
            ) : (
                <ul className="mt-4 space-y-4">
                    {proposals.map((proposal) => (
                        <li key={proposal.id} className="p-4 border rounded">
                            <h3 className="font-bold">{proposal.title}</h3>
                            <p>{proposal.description}</p>
                            <p className="text-xs text-gray-500">
                                Start: {new Date(proposal.startTime * 1000).toLocaleString()}<br/>
                                End: {new Date(proposal.endTime * 1000).toLocaleString()}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div> */}
        <ProposalList proposals={proposals} />
            </div>
        </div>
    );
}
