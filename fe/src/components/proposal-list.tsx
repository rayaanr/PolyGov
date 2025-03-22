import useVoteStats from "@/hooks/useVoteStats";
import { CombinedProposal } from "@/lib/types";
import Link from "next/link";
import React from "react";
import { Badge } from "./ui/badge";
import { getBadgeVariant, getStatusText } from "@/lib/utils";
import { Progress } from "./ui/progress";
import { MAIN_CONFIG } from "@/constants/config";
import useProposals from "@/hooks/useProposals";
import { ProposalSkeleton } from "./proposal-skeleton";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";

export function ProposalList() {
    const { combinedProposals, isLoading, error, totalCount } = useProposals();

    if (isLoading) return <ProposalSkeleton />;
    if (error) return <div>Error: {error.message}</div>;
    if (!totalCount) return <div>No proposals found</div>;

    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {combinedProposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
        </div>
    );
}

const VoteProgress = ({ label, percentage }: { label: string; percentage: string }) => (
    <>
        <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{percentage}</span>
        </div>
        <Progress value={Number(percentage)} className="h-1" />
    </>
);

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
    const { yesPercentage, noPercentage } = useVoteStats(mainProposal, secondaryProposals);

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
                            <CardDescription className="line-clamp-2 mt-1 text-xs h-8">
                                {mainProposal.description}
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
                        <VoteProgress label="Total For" percentage={yesPercentage} />
                        <VoteProgress label="Total Against" percentage={noPercentage} />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <ChainBadge icon={MAIN_CONFIG.icon} chainName={MAIN_CONFIG.name} />

                        {secondaryProposals.map(({ chainName }) => (
                            <ChainBadge
                                key={chainName}
                                icon={chainName === "Arbitrum Sepolia" ? "/arb.png" : ""}
                                chainName={chainName}
                            />
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="pt-2 pb-3 border-t border-border flex justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarIcon className="size-3" />
                        <span>
                            Start: {format(new Date(Number(mainProposal.startTime)), "MMM d, yyyy")}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span>
                            End: {format(new Date(Number(mainProposal.endTime)), "MMM d, yyyy")}
                        </span>
                    </div>
                </CardFooter>
            </Card>
        </Link>
    );
}
