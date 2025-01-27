import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Proposal } from "@/lib/types";
import { chainColors } from "@/lib/mock-data";

interface ProposalListProps {
    proposals: Proposal[];
}

export function ProposalList({ proposals }: ProposalListProps) {
    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {proposals.map((proposal) => (
                <Link
                    key={proposal.id}
                    href={`/proposal/${proposal.id}`}
                    className="block transition-colors hover:bg-accent rounded-lg"
                >
                    <div className="rounded-lg border p-4 space-y-4 h-full">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-semibold">{proposal.title}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {proposal.description}
                                </p>
                            </div>
                            <Badge
                                variant={
                                    proposal.status === "active"
                                        ? "default"
                                        : proposal.status === "passed"
                                        ? "default"
                                        : proposal.status === "failed"
                                        ? "destructive"
                                        : "secondary"
                                }
                            >
                                {proposal.status}
                            </Badge>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Total For</span>
                                <span>
                                    {((proposal.totalVotes.for / proposal.quorum) * 100).toFixed(1)}
                                    %
                                </span>
                            </div>
                            <Progress
                                value={(proposal.totalVotes.for / proposal.quorum) * 100}
                                className="h-2"
                            />
                            <div className="flex justify-between text-sm">
                                <span>Total Against</span>
                                <span>
                                    {(
                                        (proposal.totalVotes.against / proposal.quorum) *
                                        100
                                    ).toFixed(1)}
                                    %
                                </span>
                            </div>
                            <Progress
                                value={(proposal.totalVotes.against / proposal.quorum) * 100}
                                className="h-2"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {proposal.votesPerChain.map((chainVote) => (
                                <div
                                    key={chainVote.chain}
                                    className="flex items-center gap-2 text-sm text-muted-foreground"
                                >
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: chainColors[chainVote.chain] }}
                                    />
                                    <span>{chainVote.chain}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
