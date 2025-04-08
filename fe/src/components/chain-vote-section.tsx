"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAccount } from "wagmi";
import type { CombinedProposal } from "@/lib/types";
import { MAIN_CONFIG } from "@/constants/config";
import { useVoteOnProposal } from "@/hooks/useVoteOnProposal";
import { Skeleton } from "./ui/skeleton";
import { useVotingPower } from "@/hooks/useVotingPower";
import { useHasUserVoted } from "@/hooks/useHasUserVoted";
import ProgressBar from "./ui/progress-bar";
import { SINGLE_CHAIN_VOTING_POWER } from "@/constants/const";

const PENDING_STATUS = 0;

// Extracted utility function for reuse
const formatTokenAmount = (amount: bigint) => (Number(amount) / 10 ** 18).toLocaleString();

interface ChainVoteSectionProps {
    proposal: CombinedProposal;
    id: string;
}

export function ChainVoteSection({ proposal, id }: ChainVoteSectionProps) {
    const [voteType, setVoteType] = useState<boolean | null>(null);
    const [isVoting, setIsVoting] = useState(false);

    const { isConnected } = useAccount();
    const { voteOnProposal, isPending } = useVoteOnProposal();
    const { hasVoted, isLoading: isLoadingHasVoted } = useHasUserVoted(id);
    const {
        votingPower,
        isLoading: isLoadingVotingPower,
        error: votingPowerError,
    } = useVotingPower(id);

    // Check if voting is active based on status - memoized
    const isVotingActive = useMemo(
        () => proposal.mainProposal.status === PENDING_STATUS,
        [proposal.mainProposal.status]
    );

    // Handle vote submission - memoized callback
    const handleVote = useCallback(async () => {
        if (voteType === null || !isConnected || hasVoted) return;

        try {
            setIsVoting(true);
            await voteOnProposal(id, voteType);
        } catch (error) {
            console.error("Voting failed:", error);
        } finally {
            setIsVoting(false);
        }
    }, [voteType, isConnected, hasVoted, voteOnProposal, id]);

    // Determine button state - memoized
    const buttonState = useMemo(() => {
        if (!isConnected) {
            return { disabled: true, text: "Connect your wallet to vote" };
        }
        if (isPending || isVoting) {
            return { disabled: true, text: "Submitting vote..." };
        }
        if (isLoadingHasVoted) {
            return { disabled: true, text: "Loading..." };
        }
        if (hasVoted) {
            return { disabled: true, text: "You have already voted" };
        }
        if (isLoadingVotingPower) {
            return { disabled: true, text: "Loading voting power..." };
        }
        if (votingPowerError) {
            return { disabled: true, text: "Error loading voting power" };
        }
        if (votingPower === BigInt(0)) {
            return { disabled: true, text: "No voting power" };
        }
        if (!isVotingActive) {
            return { disabled: true, text: "Voting closed" };
        }
        if (voteType === null) {
            return { disabled: true, text: "Select a vote option" };
        }

        return {
            disabled: false,
            text: "Submit Vote",
        };
    }, [
        isConnected,
        isPending,
        isVoting,
        isLoadingHasVoted,
        hasVoted,
        isLoadingVotingPower,
        votingPowerError,
        votingPower,
        isVotingActive,
        voteType,
    ]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cast Your Vote</CardTitle>
                <CardDescription>
                    Select a chain to vote from and choose your voting option
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Vote Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium block">Your Vote</label>
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            variant={voteType === true ? "success" : "outline"}
                            onClick={() => setVoteType(true)}
                            className="w-full"
                            disabled={!isVotingActive}
                        >
                            For
                        </Button>
                        <Button
                            variant={voteType === false ? "destructive" : "outline"}
                            onClick={() => setVoteType(false)}
                            className="w-full"
                            disabled={!isVotingActive}
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
                        ) : votingPowerError ? (
                            <span className="text-destructive">Error loading power</span>
                        ) : (
                            <span>{formatTokenAmount(votingPower ?? BigInt(0))} tokens</span>
                        )}
                    </div>
                    <Button className="w-full" disabled={buttonState.disabled} onClick={handleVote}>
                        {buttonState.text}
                    </Button>
                </div>

                {/* Vote Breakdown for All Chains */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium">Vote Breakdown by Chain</h4>
                    <ProgressBar
                        title={`${MAIN_CONFIG.name} (Main)`}
                        yesVotes={Number(proposal.mainProposal.yesVotes / BigInt(10 ** 18))}
                        noVotes={Number(proposal.mainProposal.noVotes / BigInt(10 ** 18))}
                        maxVotingPower={SINGLE_CHAIN_VOTING_POWER}
                    />
                    {proposal.secondaryProposals.map((sp) => (
               
                            <ProgressBar
                                key={sp.chainName}
                                title={sp.chainName}
                                yesVotes={Number(sp.proposal.yesVotes / BigInt(10 ** 18))}
                                noVotes={Number(sp.proposal.noVotes / BigInt(10 ** 18))}
                                maxVotingPower={SINGLE_CHAIN_VOTING_POWER}
                            />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
