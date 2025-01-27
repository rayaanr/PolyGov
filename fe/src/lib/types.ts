export type Chain = "ethereum" | "polygon" | "arbitrum" | "optimism";

export type ProposalStatus = "active" | "passed" | "failed" | "pending";

export interface ChainVotes {
    chain: Chain;
    forVotes: number;
    againstVotes: number;
    abstainVotes: number;
}

export interface Proposal {
    id: string;
    title: string;
    description: string;
    status: ProposalStatus;
    proposer: string;
    startTime: number;
    endTime: number;
    quorum: number;
    votesPerChain: ChainVotes[];
    totalVotes: {
        for: number;
        against: number;
        abstain: number;
    };
}

export interface GovernanceStats {
    chain: Chain;
    totalProposals: number;
    activeProposals: number;
    totalVoters: number;
    averageParticipation: number;
}
