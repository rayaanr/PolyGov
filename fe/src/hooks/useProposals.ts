import { useReadContracts, useReadContract } from "wagmi";
import { GovernanceBSCABI } from "@/constants/abi/BSCGovABI";
import { bscTestnet } from "wagmi/chains";
import { CONTRACTS } from "@/constants/contracts";

type Proposal = {
    id: bigint;
    title: string;
    description: string;
    yesVotes: bigint;
    noVotes: bigint;
    startTime: bigint;
    endTime: bigint;
    status: number;
    snapshotBlock: bigint;
};

const governanceContract = {
    address: CONTRACTS.bscTestnet.governanceContract,
    abi: GovernanceBSCABI,
};

export function useProposals() {
    // Fetch proposal count
    const { data: proposalCount, isLoading: isCountLoading } = useReadContract({
        ...governanceContract,
        functionName: "proposalCount",
        chainId: bscTestnet.id,
    });

    // Convert proposal count to number and create indices
    const totalProposals = Number(proposalCount || 0);
    const proposalIndices = Array.from({ length: totalProposals }, (_, i) => BigInt(i));

    // Fetch proposals data (always call the hook, even if there are no proposals)
    const { data: proposalsData, isLoading: isProposalsLoading } = useReadContracts({
        contracts:
            totalProposals > 0
                ? proposalIndices.map((index) => ({
                      ...governanceContract,
                      functionName: "proposals",
                      args: [index],
                      chainId: bscTestnet.id,
                  }))
                : [], // Provide an empty array if no proposals
    });

    // Process and format proposals data
    const proposals: Proposal[] =
        proposalsData
            ?.filter((result) => result.status === "success")
            .map((result) => {
                const [
                    id,
                    title,
                    description,
                    yesVotes,
                    noVotes,
                    startTime,
                    endTime,
                    status,
                    snapshotBlock,
                ] = result.result as unknown as [
                    bigint,
                    string,
                    string,
                    bigint,
                    bigint,
                    bigint,
                    bigint,
                    number,
                    bigint
                ];

                return {
                    id,
                    title,
                    description,
                    yesVotes,
                    noVotes,
                    startTime,
                    endTime,
                    status,
                    snapshotBlock,
                };
            }) || [];

    return {
        proposals,
        isLoading: isCountLoading || isProposalsLoading,
    };
}
