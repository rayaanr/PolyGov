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
        <div className="flex justify-between text-sm">
            <span>{label}</span>
            <span>{percentage}%</span>
        </div>
        <Progress value={Number(percentage)} className="h-2" />
    </>
);

const ChainBadge = ({ icon, chainName }: { icon: string; chainName: string }) => (
    <div className="flex text-sm gap-1 items-center">
        <Image
            src={icon}
            alt={`Chain ${chainName}`}
            width={10}
            height={10}
            className="rounded-full size-4"
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
            <div className="rounded-lg border p-4 space-y-4 h-full">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold">{mainProposal.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                            {mainProposal.description}
                        </p>
                    </div>
                    <Badge variant={getBadgeVariant(mainProposal.status)}>
                        {getStatusText(mainProposal.status)}
                    </Badge>
                </div>

                <div className="space-y-2">
                    <VoteProgress label="Total For" percentage={yesPercentage} />
                    <VoteProgress label="Total Against" percentage={noPercentage} />
                </div>

                <div className="flex flex-wrap gap-5">
                    <ChainBadge icon={MAIN_CONFIG.icon} chainName={MAIN_CONFIG.name} />

                    {secondaryProposals.map(({ chainName }) => (
                        <ChainBadge
                            key={chainName}
                            icon={chainName === "Arbitrum Sepolia" ? "/arb.png" : ""}
                            chainName={chainName}
                        />
                    ))}
                </div>
            </div>
        </Link>
    );
}
