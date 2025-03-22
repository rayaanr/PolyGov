import { MAIN_CONFIG } from "@/constants/config";

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

//---------------------
enum ProposalStatusEnum {
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
}

// Main proposal details
export interface ProposalDetails {
    proposalId: string;
    title: string;
    description: string;
    yesVotes: bigint;
    noVotes: bigint;
    startTime: bigint;
    endTime: bigint;
    status: ProposalStatusEnum;
    finalYesVotes: bigint;
    finalNoVotes: bigint;
    voteTallyFinalized: boolean;
}

// Secondary proposal details
export interface SecondaryProposalDetails {
    proposalId: string;
    title: string;
    description: string;
    yesVotes: bigint;
    noVotes: bigint;
    startTime: bigint;
    endTime: bigint;
    status: ProposalStatusEnum;
    voteTallied: boolean;
}

// Types
export type ChainConfig = typeof MAIN_CONFIG;
export type ProposalId = string;

// Secondary proposal wrapper
export interface SecondaryProposal {
    chainName: string;
    proposal: SecondaryProposalDetails;
}

// Combined proposal structure
export interface CombinedProposal {
    id: ProposalId;
    mainProposal: ProposalDetails;
    secondaryProposals: SecondaryProposal[];
}
