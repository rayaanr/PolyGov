"use client";

import { notFound } from "next/navigation";
import { ChainVoteSection } from "@/components/chain-vote-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { ProposalDetailSkeleton } from "@/components/proposal-detail-skeleton";
import useProposalById from "@/hooks/useProposalById";
import { getBadgeVariant, getStatusText } from "@/lib/utils";
import useVoteStats from "@/hooks/useVoteStats";
import { TOTAL_VOTING_POWER } from "@/constants/const";

export default function ProposalDetails({ id }: { id: string }) {
    const { proposal, isLoading, error } = useProposalById(id);

    if (isLoading) {
        return <ProposalDetailSkeleton />;
    }

    if (error) {
        return <div>Error: {error.message}</div>;
    }

    if (!proposal) {
        return notFound();
    }

    const { yes, yesPercentage, no, noPercentage } = useVoteStats(
        proposal.mainProposal,
        proposal.secondaryProposals
    );

    return (
        <div className="container max-w-3xl mx-auto p-4 space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-medium">{proposal.mainProposal.title}</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                        {proposal.mainProposal.description}
                    </p>

                    <div className="flex flex-wrap gap-4 mt-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarIcon className="h-4 w-4" />
                            <span>
                                Start:{" "}
                                {format(
                                    new Date(Number(proposal.mainProposal.startTime)),
                                    "MMM d, yyyy"
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                                End:{" "}
                                {format(
                                    new Date(Number(proposal.mainProposal.endTime)),
                                    "MMM d, yyyy"
                                )}
                            </span>
                        </div>
                    </div>
                </div>
                <Badge variant={getBadgeVariant(proposal.mainProposal.status)} className="text-sm">
                    {getStatusText(proposal.mainProposal.status)}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium">Overall Results</CardTitle>
                    <CardDescription className="text-xs">
                        Total votes: {TOTAL_VOTING_POWER.toLocaleString()}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>For</span>
                            <span>{yes}</span>
                        </div>
                        <Progress value={Number(yesPercentage)} className="h-1" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Against</span>
                            <span>{no}</span>
                        </div>
                        <Progress value={Number(noPercentage)} className="h-1" />
                    </div>
                </CardContent>
            </Card>

            <ChainVoteSection id={id} proposal={proposal} />
        </div>
    );
}
