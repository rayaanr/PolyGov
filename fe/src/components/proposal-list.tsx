import useVoteStats from "@/hooks/useVoteStats";
import { CombinedProposal } from "@/lib/types";
import Link from "next/link";
import React from "react";
import { Badge } from "./ui/badge";
import { formatDate, getBadgeVariant, getStatusText } from "@/lib/utils";
import CONFIG, { MAIN_CONFIG } from "@/constants/config";
import useProposals from "@/hooks/useProposals";
import { ProposalSkeleton } from "./proposal-skeleton";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { CalendarIcon, Clock } from "lucide-react";
import { useIpfsData } from "@/hooks/useIpfsData";
import ProgressBar from "./ui/progress-bar";
import { TOTAL_VOTING_POWER } from "@/constants/const";

export function ProposalList() {
    const { combinedProposals, isLoading, error, totalCount } = useProposals();

    if (isLoading) return <ProposalSkeleton />;
    if (error) return <div>Error: {error.message}</div>;
    if (!totalCount)
        return (
            <div className="pt-36 text-center">
                <h1 className="text-2xl font-semibold">No proposals found</h1>
                <p className="text-sm text-muted-foreground">
                    There are no proposals available at the moment.
                </p>
            </div>
        );

    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {combinedProposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
        </div>
    );
}

const ChainBadge = ({ icon, chainName }: { icon: string; chainName: string }) => (
    <div className="flex text-xs gap-1 items-center rounded-full bg-secondary text-secondary-foreground px-1">
        <Image
            src={icon}
            alt={`Chain ${chainName}`}
            width={10}
            height={10}
            className="rounded-full size-3"
        />
        <span>{chainName}</span>
    </div>
);

function ProposalCard({ proposal }: { proposal: CombinedProposal }) {
    const { id, mainProposal, secondaryProposals } = proposal;
    const { yes, no } = useVoteStats(mainProposal, secondaryProposals);

    const {
        data: ipfsData,
        isLoading: ipfsLoading,
        error: ipfsError,
    } = useIpfsData(mainProposal.ipfsHash);

    return (
        <Link
            key={id}
            href={`/proposal/${id}`}
            className="block transition-colors hover:bg-accent rounded-lg"
        >
            <Card className="h-full card-hover-effect border-border flex flex-col">
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="text-base font-medium">
                                {mainProposal.title}
                            </CardTitle>
                            <CardDescription className="line-clamp-2 mt-1 text-xs h-8 break-words">
                                {ipfsLoading
                                    ? "Loading..."
                                    : ipfsError
                                    ? "Failed to load description"
                                    : ipfsData?.description || mainProposal.ipfsHash}
                            </CardDescription>
                        </div>
                        <Badge
                            variant={getBadgeVariant(mainProposal.status)}
                            className="ml-2 text-xs font-normal rounded-full"
                        >
                            {getStatusText(mainProposal.status)}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 py-2 flex-grow">
                    <div className="space-y-3">
                        <ProgressBar
                            yesVotes={yes}
                            noVotes={no}
                            maxVotingPower={TOTAL_VOTING_POWER}
                        />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <ChainBadge icon={MAIN_CONFIG.icon} chainName={MAIN_CONFIG.name} />

                        {secondaryProposals.map(({ chainName }) => (
                            <ChainBadge
                                key={chainName}
                                icon={
                                    CONFIG.SECONDARY_CHAINS.find((c) => c.name === chainName)
                                        ?.icon || ""
                                }
                                chainName={chainName}
                            />
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="pt-2 pb-3 border-t border-border flex justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarIcon className="size-3" />
                        <span>Start: {formatDate(Number(mainProposal.startTime))}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span>End: {formatDate(Number(mainProposal.endTime))}</span>
                    </div>
                </CardFooter>
            </Card>
        </Link>
    );
}
