"use client";

import { MAIN_CONFIG } from "@/constants/config";
import { GET_PROPOSAL_DETAILS_KEY, GET_PROPOSAL_IDS_KEY } from "@/constants/keys";
import { ProposalDetails } from "@/lib/types";
import { getStatusText } from "@/lib/utils";
import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";

// Types
interface VoteData {
    percentage: string;
    rawVotes: number;
}

// Custom hook for proposal data
const useProposals = () => {
    const {
        data: proposalIds = [],
        isLoading: isLoadingIds,
        error: idsError,
    } = useReadContract({
        address: MAIN_CONFIG.contracts.governance,
        chainId: MAIN_CONFIG.chainId,
        abi: MAIN_CONFIG.abi.governance,
        functionName: GET_PROPOSAL_IDS_KEY,
    }) as { data: string[]; isLoading: boolean; error: Error | null };

    const latestIds = proposalIds.slice(-16).reverse();

    const {
        data: proposalsData = [],
        isLoading: isLoadingDetails,
        error: detailsError,
    } = useReadContracts({
        contracts: latestIds.map((id) => ({
            address: MAIN_CONFIG.contracts.governance,
            chainId: MAIN_CONFIG.chainId,
            abi: MAIN_CONFIG.abi.governance,
            functionName: GET_PROPOSAL_DETAILS_KEY,
            args: [id],
        })),
    });

    return {
        proposalIds: latestIds,
        proposals: proposalsData.map((result) => result.result as ProposalDetails),
        isLoading: isLoadingIds || isLoadingDetails,
        error: idsError || detailsError,
        totalCount: proposalIds.length,
    };
};

// Utility functions
const getVoteData = (votes: number): VoteData => ({
    percentage: ((votes / 20000) * 100).toFixed(1),
    rawVotes: Number(votes) / 10 ** 18,
});

const getBadgeVariant = (status: number) => {
    const statusText = getStatusText(status);
    return statusText === "Active"
        ? "default"
        : statusText === "Rejected"
        ? "destructive"
        : statusText === "Accepted"
        ? "outline"
        : "secondary";
};

const ProposalCard = ({ id, proposal }: { id: string; proposal: ProposalDetails }) => {
    const yesVotes = getVoteData(Number(proposal.yesVotes));
    const noVotes = getVoteData(Number(proposal.noVotes));

    return (
        <Link
            href={`/proposal/${id}`}
            className="block transition-colors hover:bg-accent rounded-lg"
        >
            <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold">{proposal.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                            {proposal.description}
                        </p>
                    </div>
                    <Badge variant={getBadgeVariant(proposal.status)}>
                        {getStatusText(proposal.status)}
                    </Badge>
                </div>
                <div className="space-y-2">
                    <VoteProgress label="Total For" percentage={yesVotes.percentage} />
                    <VoteProgress label="Total Against" percentage={noVotes.percentage} />
                </div>
            </div>
        </Link>
    );
};

const VoteProgress = ({ label, percentage }: { label: string; percentage: string }) => (
    <>
        <div className="flex justify-between text-sm">
            <span>{label}</span>
            <span>{percentage}%</span>
        </div>
        <Progress value={parseFloat(percentage)} className="h-2" />
    </>
);

const ProposalList = () => {
    const { proposalIds, proposals, isLoading, error, totalCount } = useProposals();

    if (isLoading) return <div>Loading proposals...</div>;
    if (error) return <div>Error: {error.message}</div>;
    if (totalCount === 0) return <div>No proposals found</div>;

    return (
        <div className="space-y-6">
            <p className="font-medium">Total Proposals: {totalCount}</p>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {proposals.map((proposal, index) =>
                    proposal ? (
                        <ProposalCard
                            key={proposalIds[index]}
                            id={proposalIds[index]}
                            proposal={proposal}
                        />
                    ) : null
                )}
            </div>
        </div>
    );
};

export default ProposalList;
