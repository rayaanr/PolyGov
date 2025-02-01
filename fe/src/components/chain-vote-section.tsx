"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import type { Chain, Proposal } from "@/lib/types";
import { chainColors } from "@/lib/mock-data";

interface ChainVoteSectionProps {
    proposal: Proposal;
}

export function ChainVoteSection({ proposal }: ChainVoteSectionProps) {
    const [selectedChain, setSelectedChain] = useState<Chain>("ethereum");
    const [voteType, setVoteType] = useState<"for" | "against" | "abstain" | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cast Your Vote</CardTitle>
                <CardDescription>
                    Select a chain to vote from and choose your voting option
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <label className="text-sm font-medium mb-2 block">Select Chain</label>
                    <Select
                        value={selectedChain}
                        onValueChange={(value) => setSelectedChain(value as Chain)}
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.keys(chainColors).map((chain) => (
                                <SelectItem key={chain} value={chain}>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: chainColors[chain as Chain] }}
                                        />
                                        <span>{chain}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium block">Your Vote</label>
                    <div className="grid grid-cols-3 gap-4">
                        <Button
                            variant={voteType === "for" ? "default" : "outline"}
                            onClick={() => setVoteType("for")}
                            className="w-full"
                        >
                            For
                        </Button>
                        <Button
                            variant={voteType === "against" ? "default" : "outline"}
                            onClick={() => setVoteType("against")}
                            className="w-full"
                        >
                            Against
                        </Button>
                        <Button
                            variant={voteType === "abstain" ? "default" : "outline"}
                            onClick={() => setVoteType("abstain")}
                            className="w-full"
                        >
                            Abstain
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Voting Power</span>
                        <span>1,000 votes</span>
                    </div>
                    <Button className="w-full" disabled={!voteType || proposal.status !== "active"}>
                        Submit Vote
                    </Button>
                </div>

                <div className="space-y-4">
                    <h4 className="text-sm font-medium">Votes by Chain</h4>
                    {proposal.votesPerChain.map((chainVote) => (
                        <div key={chainVote.chain} className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: chainColors[chainVote.chain] }}
                                />
                                <span className="text-sm font-medium">{chainVote.chain}</span>
                                <span className="text-sm text-muted-foreground ml-auto">
                                    {(
                                        chainVote.forVotes +
                                        chainVote.againstVotes +
                                        chainVote.abstainVotes
                                    ).toLocaleString()}{" "}
                                    votes
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <div className="text-xs">For</div>
                                    <Progress
                                        value={
                                            (chainVote.forVotes /
                                                (chainVote.forVotes +
                                                    chainVote.againstVotes +
                                                    chainVote.abstainVotes)) *
                                            100
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs">Against</div>
                                    <Progress
                                        value={
                                            (chainVote.againstVotes /
                                                (chainVote.forVotes +
                                                    chainVote.againstVotes +
                                                    chainVote.abstainVotes)) *
                                            100
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs">Abstain</div>
                                    <Progress
                                        value={
                                            (chainVote.abstainVotes /
                                                (chainVote.forVotes +
                                                    chainVote.againstVotes +
                                                    chainVote.abstainVotes)) *
                                            100
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
