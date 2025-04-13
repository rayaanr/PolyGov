"use client";

import { notFound } from "next/navigation";
import { ChainVoteSection } from "@/components/chain-vote-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Clock } from "lucide-react";
import { ProposalDetailSkeleton } from "@/components/proposal-detail-skeleton";
import useProposalById from "@/hooks/useProposalById";
import { formatDate, getBadgeVariant, getStatusText } from "@/lib/utils";
import useVoteStats from "@/hooks/useVoteStats";
import { TOTAL_VOTING_POWER } from "@/constants/const";
import { useIpfsData } from "@/hooks/useIpfsData";
import ProgressBar from "./ui/progress-bar";
import Link from "next/link";
import { MAIN_CONFIG } from "@/constants/config";

export default function ProposalDetails({ id }: { id: string }) {
    const { proposal, isLoading, error } = useProposalById(id);

    const { yes, no } = useVoteStats(
        proposal?.mainProposal ?? ({} as any),
        proposal?.secondaryProposals ?? []
    );

    const {
        data: ipfsData,
        isLoading: ipfsLoading,
        error: ipfsError,
    } = useIpfsData(proposal?.mainProposal.ipfsHash);

    if (isLoading) {
        return <ProposalDetailSkeleton />;
    }

    if (error) {
        return <div>Error: {error.message}</div>;
    }

    if (!proposal) {
        return notFound();
    }

    return (
        <div className="container max-w-3xl mx-auto p-4 space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-medium">{proposal.mainProposal.title}</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                        {ipfsLoading
                            ? "Loading..."
                            : ipfsError
                            ? "Failed to load description"
                            : ipfsData?.description || proposal.mainProposal.ipfsHash}
                    </p>

                    <h4 className="text-sm text-muted-foreground mt-2">
                        Proposed by:&nbsp;
                        <Link
                            className="text-primary/80 hover:underline italic"
                            href={`${MAIN_CONFIG.explorerUrl}/address/${proposal.mainProposal.proposer}`}
                            target="_blank"
                        >
                            {proposal.mainProposal.proposer}
                        </Link>
                    </h4>

                    <div className="flex flex-wrap gap-4 mt-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarIcon className="h-4 w-4" />
                            <span>
                                Start: {formatDate(Number(proposal.mainProposal.startTime))}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>End: {formatDate(Number(proposal.mainProposal.endTime))}</span>
                        </div>
                    </div>
                </div>
                <Badge
                    variant={getBadgeVariant(proposal.mainProposal.status)}
                    className="text-sm rounded-full"
                >
                    {getStatusText(proposal.mainProposal.status)}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium">Overall Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ProgressBar yesVotes={yes} noVotes={no} maxVotingPower={TOTAL_VOTING_POWER} />
                </CardContent>
            </Card>

            <ChainVoteSection id={id} proposal={proposal} />
        </div>
    );
}
