"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAccount } from "wagmi";
import type { CombinedProposal } from "@/lib/types";
import { MAIN_CONFIG } from "@/constants/config";
import { useVoteOnProposal } from "@/hooks/useVoteOnProposal";
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

    // Add a loading state indicator
    const isLoading = isLoadingHasVoted || isLoadingVotingPower || isPending || isVoting;

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

    // Enhance button state logic
    const buttonState = useMemo(() => {
        if (!isConnected) {
            return { disabled: true, text: "Connect your wallet to vote" };
        }
        if (isPending || isVoting) {
            return {
                disabled: true,
                text: isPending ? "Confirming transaction..." : "Processing vote...",
            };
        }
        if (isLoadingHasVoted) {
            return { disabled: true, text: "Checking vote status..." };
        }
        if (hasVoted) {
            return { disabled: true, text: "You have already voted" };
        }
        if (isLoadingVotingPower) {
            return { disabled: true, text: "Calculating voting power..." };
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
        <div className="space-y-4">
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
                                disabled={!isVotingActive || isLoading}
                            >
                                For
                            </Button>
                            <Button
                                variant={voteType === false ? "destructive" : "outline"}
                                onClick={() => setVoteType(false)}
                                className="w-full"
                                disabled={!isVotingActive || isLoading}
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
                                <span className="text-muted-foreground animate-pulse">
                                    Calculating power...
                                </span>
                            ) : votingPowerError ? (
                                <span className="text-destructive">Error loading power</span>
                            ) : (
                                <span>{formatTokenAmount(votingPower ?? BigInt(0))} tokens</span>
                            )}
                        </div>
                        <Button
                            className="w-full relative"
                            disabled={buttonState.disabled}
                            onClick={handleVote}
                        >
                            {isLoading && (
                                <span className="absolute left-4 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                            )}
                            {buttonState.text}
                        </Button>
                        {isLoading && (
                            <p className="text-xs text-center text-muted-foreground">
                                This may take a moment. Please wait...
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Vote Breakdown Card - Now Separate */}
            <Card>
                <CardHeader>
                    <CardTitle>Vote Breakdown</CardTitle>
                    <CardDescription>Current voting status across all chains</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                </CardContent>
            </Card>
        </div>
    );
}
