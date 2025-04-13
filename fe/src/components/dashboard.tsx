"use client";

import { ProposalList } from "./proposal-list";
import { CreateProposalDialog } from "./create-proposal-dialog";

export default function Dashboard() {
    return (
        <div className="container mx-auto p-4 space-y-8">
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
