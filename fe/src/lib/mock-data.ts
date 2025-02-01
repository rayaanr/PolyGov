import { Chain, Proposal, GovernanceStats } from "./types";

export const mockProposals: Proposal[] = [
    {
        id: "1",
        title: "Upgrade Protocol Parameters",
        description: "Proposal to adjust key protocol parameters including fees and thresholds",
        status: "active",
        proposer: "0x1234...5678",
        startTime: Date.now() - 86400000,
        endTime: Date.now() + 86400000 * 2,
        quorum: 2000000,
        votesPerChain: [
            {
                chain: "ethereum",
                forVotes: 800000,
                againstVotes: 200000,
                abstainVotes: 50000,
            },
            {
                chain: "polygon",
                forVotes: 400000,
                againstVotes: 100000,
                abstainVotes: 25000,
            },
            {
                chain: "arbitrum",
                forVotes: 300000,
                againstVotes: 200000,
                abstainVotes: 25000,
            },
        ],
        totalVotes: {
            for: 1500000,
            against: 500000,
            abstain: 100000,
        },
    },
    {
        id: "2",
        title: "Add New Market",
        description: "Proposal to add a new market for asset XYZ",
        status: "active",
        proposer: "0x9876...4321",
        startTime: Date.now() - 86400000 * 2,
        endTime: Date.now() + 86400000,
        quorum: 1000000,
        votesPerChain: [
            {
                chain: "ethereum",
                forVotes: 400000,
                againstVotes: 100000,
                abstainVotes: 25000,
            },
            {
                chain: "optimism",
                forVotes: 400000,
                againstVotes: 100000,
                abstainVotes: 25000,
            },
        ],
        totalVotes: {
            for: 800000,
            against: 200000,
            abstain: 50000,
        },
    },
    {
        id: "3",
        title: "Treasury Distribution",
        description: "Proposal to distribute treasury funds to contributors",
        status: "passed",
        proposer: "0x4567...8901",
        startTime: Date.now() - 86400000 * 5,
        endTime: Date.now() - 86400000 * 2,
        quorum: 2000000,
        votesPerChain: [
            {
                chain: "arbitrum",
                forVotes: 2500000,
                againstVotes: 300000,
                abstainVotes: 200000,
            },
        ],
        totalVotes: {
            for: 2500000,
            against: 300000,
            abstain: 200000,
        },
    },
    {
        id: "4",
        title: "Protocol Integration",
        description: "Proposal to integrate with Protocol XYZ",
        status: "pending",
        proposer: "0x7890...1234",
        startTime: Date.now() + 86400000,
        endTime: Date.now() + 86400000 * 4,
        quorum: 1500000,
        votesPerChain: [],
        totalVotes: {
            for: 0,
            against: 0,
            abstain: 0,
        },
    },
];

export const mockStats: GovernanceStats[] = [
    {
        chain: "ethereum",
        totalProposals: 45,
        activeProposals: 2,
        totalVoters: 12500,
        averageParticipation: 68,
    },
    {
        chain: "polygon",
        totalProposals: 32,
        activeProposals: 1,
        totalVoters: 8900,
        averageParticipation: 72,
    },
    {
        chain: "arbitrum",
        totalProposals: 28,
        activeProposals: 3,
        totalVoters: 6700,
        averageParticipation: 65,
    },
    {
        chain: "optimism",
        totalProposals: 23,
        activeProposals: 2,
        totalVoters: 5400,
        averageParticipation: 70,
    },
];

export const chainColors: Record<Chain, string> = {
    ethereum: "#627EEA",
    polygon: "#8247E5",
    arbitrum: "#28A0F0",
    optimism: "#FF0420",
};

export const chainIcons: Record<Chain, string> = {
    ethereum: "⟠",
    polygon: "⬡",
    arbitrum: "◆",
    optimism: "⭕",
};
