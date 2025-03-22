"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { ProposalList } from "./proposal-list";
import { mockStats } from "@/lib/mock-data";
import { StatsGrid } from "./stats-grid";
import { CreateProposalDialog } from "./create-proposal-dialog";

export default function Dashboard() {
    return (
        <div className="container mx-auto p-4 space-y-8">
            <div className="flex flex-col space-y-2 mt-4">
                <h1 className="text-3xl font-medium">Cross-Chain Governance</h1>
                <p className="text-sm text-muted-foreground">
                    Manage and vote on proposals across multiple chains
                </p>
            </div>

            <StatsGrid stats={mockStats} />

            <Separator className="my-6" />

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-medium">Active Proposals</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Current governance proposals across all chains
                        </p>
                    </div>
                    <CreateProposalDialog />
                </div>
                <ProposalList />
            </div>
        </div>
    );
}
