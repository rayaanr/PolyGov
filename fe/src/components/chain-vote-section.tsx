"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import type { CombinedProposal } from "@/lib/types";
import { MAIN_CONFIG } from "@/constants/config";
import { useVoteOnProposal } from "@/hooks/useVoteOnProposal";
import { Skeleton } from "./ui/skeleton";
import { useVotingPower } from "@/hooks/useVotingPower";

// Constants
const TOTAL_TOKENS_PER_CHAIN = BigInt(10000 * 10 ** 18); // 10,000 tokens in 10^18 format
const PENDING_STATUS = 0;

interface ChainVoteSectionProps {
    proposal: CombinedProposal;
    id: string;
}

export function ChainVoteSection({ proposal, id }: ChainVoteSectionProps) {
    const [selectedChain, setSelectedChain] = useState<string>(
        proposal.secondaryProposals[0]?.chainName || "main"
    );
    const [voteType, setVoteType] = useState<boolean | null>(null);

    const { voteOnProposal, isPending } = useVoteOnProposal();
    const {
        votingPower,
        isLoading: isLoadingVotingPower,
        error: votingPowerError,
    } = useVotingPower(id);

    // Format token amount from BigInt to readable number
    const formatTokenAmount = (amount: bigint) => (Number(amount) / 10 ** 18).toLocaleString();

    // Check if voting is active based on status
    const isVotingActive = proposal.mainProposal.status === PENDING_STATUS;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cast Your Vote</CardTitle>
                <CardDescription>
                    Select a chain to vote from and choose your voting option
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Chain Selection */}
                <div>
                    <label className="text-sm font-medium mb-2 block">Select Chain</label>
                    <Select value={selectedChain} onValueChange={setSelectedChain}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="main">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" />
                                    <span>{MAIN_CONFIG.name}</span>
                                </div>
                            </SelectItem>
                            {proposal.secondaryProposals.map((sp) => (
                                <SelectItem key={sp.chainName} value={sp.chainName}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" />
                                        <span>{sp.chainName}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Vote Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium block">Your Vote</label>
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            variant={voteType === true ? "success" : "outline"}
                            onClick={() => setVoteType(true)}
                            className="w-full"
                        >
                            For
                        </Button>
                        <Button
                            variant={voteType === false ? "destructive" : "outline"}
                            onClick={() => setVoteType(false)}
                            className="w-full"
                        >
                            Against
                        </Button>
                    </div>
                </div>

                {/* Voting Power and Submit */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Voting Power</span>
                        {isLoadingVotingPower ? (
                            <Skeleton className="w-24 h-3" />
                        ) : (
                            <span>{formatTokenAmount(votingPower ?? BigInt(0))} tokens</span>
                        )}
                    </div>
                    <Button
                        className="w-full"
                        disabled={!isVotingActive || voteType === null || isPending}
                        onClick={() => {
                            if (voteType !== null) {
                                voteOnProposal(id, voteType);
                            }
                        }}
                    >
                        Submit Vote
                    </Button>
                </div>

                {/* Vote Breakdown for All Chains */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium">Vote Breakdown by Chain</h4>

                    {/* Main Proposal Votes */}
                    <VoteBreakdown
                        chainName={`${MAIN_CONFIG.name} (Main)`}
                        yesVotes={BigInt(proposal.mainProposal.yesVotes)}
                        noVotes={BigInt(proposal.mainProposal.noVotes)}
                        formatTokenAmount={formatTokenAmount}
                    />

                    {/* Secondary Proposals Votes */}
                    {proposal.secondaryProposals.map((sp) => (
                        <VoteBreakdown
                            key={sp.chainName}
                            chainName={sp.chainName}
                            yesVotes={BigInt(sp.proposal.yesVotes)}
                            noVotes={BigInt(sp.proposal.noVotes)}
                            formatTokenAmount={formatTokenAmount}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

// Extracted component for vote breakdown to reduce repetition
function VoteBreakdown({
    chainName,
    yesVotes,
    noVotes,
    formatTokenAmount,
}: {
    chainName: string;
    yesVotes: bigint;
    noVotes: bigint;
    formatTokenAmount: (amount: bigint) => string;
}) {
    const total = yesVotes + noVotes;
    const yesPercentage = Number((yesVotes * BigInt(100)) / TOTAL_TOKENS_PER_CHAIN);
    const noPercentage = Number((noVotes * BigInt(100)) / TOTAL_TOKENS_PER_CHAIN);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" />
                <span className="text-sm font-medium">{chainName}</span>
                <span className="text-sm text-muted-foreground ml-auto">
                    {formatTokenAmount(total)} tokens
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <div className="text-xs">For ({formatTokenAmount(yesVotes)})</div>
                    <Progress value={yesPercentage} className="h-1" />
                </div>
                <div className="space-y-1">
                    <div className="text-xs">Against ({formatTokenAmount(noVotes)})</div>
                    <Progress value={noPercentage} className="h-1" />
                </div>
            </div>
        </div>
    );
}
