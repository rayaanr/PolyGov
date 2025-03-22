import { notFound } from "next/navigation";
import { ChainVoteSection } from "@/components/chain-vote-section";
import { mockProposals } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";

export default function ProposalPage({ params }: { params: { id: string } }) {
    const proposal = mockProposals.find((p) => p.id === params.id);

    if (!proposal) {
        notFound();
    }

    const totalVotes = proposal.totalVotes.for + proposal.totalVotes.against;

    return (
        <div className="container max-w-3xl mx-auto p-4 space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-medium">{proposal.title}</h1>
                    <p className="text-sm text-muted-foreground mt-2">{proposal.description}</p>

                    <div className="flex flex-wrap gap-4 mt-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarIcon className="h-4 w-4" />
                            <span>
                                Start: {format(new Date(proposal.startTime), "MMM d, yyyy")}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>End: {format(new Date(proposal.endTime), "MMM d, yyyy")}</span>
                        </div>
                    </div>
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
                    className="text-sm"
                >
                    {proposal.status}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium">Overall Results</CardTitle>
                    <CardDescription className="text-xs">
                        Total votes: {totalVotes.toLocaleString()}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>For</span>
                            <span>
                                {((proposal.totalVotes.for / proposal.quorum) * 100).toFixed(1)}%
                            </span>
                        </div>
                        <Progress
                            value={(proposal.totalVotes.for / proposal.quorum) * 100}
                            className="h-1"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Against</span>
                            <span>
                                {((proposal.totalVotes.against / proposal.quorum) * 100).toFixed(1)}
                                %
                            </span>
                        </div>
                        <Progress
                            value={(proposal.totalVotes.against / proposal.quorum) * 100}
                            className="h-1"
                        />
                    </div>
                </CardContent>
            </Card>

            <ChainVoteSection proposal={proposal} />
        </div>
    );
}
