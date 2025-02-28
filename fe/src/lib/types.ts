export type ProposalStatus = "pending" | "active" | "passed" | "failed";

export type Proposal = {
    id: string;
    title: string;
    description: string;
    proposer: string;
    startTime: number;
    endTime: number;
    status: ProposalStatus;
    totalVotes: {
        for: number;
        against: number;
    };
    quorum: number;
    votesPerChain: {
        chain: string;
        for: number;
        against: number;
    }[];
};
