import { notFound } from "next/navigation";
import { ChainVoteSection } from "@/components/chain-vote-section";
import { mockProposals } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function ProposalPage({ params }: { params: { id: string } }) {
    const proposal = mockProposals.find((p) => p.id === params.id);

    if (!proposal) {
        notFound();
    }

    const totalVotes =
        proposal.totalVotes.for + proposal.totalVotes.against + proposal.totalVotes.abstain;

    return (
        <div className="container max-w-3xl mx-auto p-4 space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{proposal.title}</h1>
                    <p className="text-muted-foreground mt-2">{proposal.description}</p>
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
                    className={`text-sm ${
                        proposal.status === "passed" ? "bg-green-500 hover:bg-green-600" : ""
                    }`}
                >
                    {proposal.status}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Overall Results</CardTitle>
                    <CardDescription>Total votes: {totalVotes.toLocaleString()}</CardDescription>
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
                            className="h-2"
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
                            className="h-2"
                        />
                    </div>
                    {/* <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Abstain</span>
                            <span>
                                {((proposal.totalVotes.abstain / proposal.quorum) * 100).toFixed(1)}
                                %
                            </span>
                        </div>
                        <Progress
                            value={(proposal.totalVotes.abstain / proposal.quorum) * 100}
                            className="h-2"
                        />
                    </div> */}
                </CardContent>
            </Card>

            <ChainVoteSection proposal={proposal} />
        </div>
    );
}
