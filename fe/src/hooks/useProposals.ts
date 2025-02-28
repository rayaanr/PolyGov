import { useReadContract, useChainId, usePublicClient } from "wagmi";
import abi from "../constants/abi.json";
import { useEffect, useState } from "react";
import type { Proposal, ProposalStatus } from "@/lib/types";
import { GOVERNANCE_ADDRESSES } from "@/constants/contracts";

const STATUS_MAP: ProposalStatus[] = ["pending", "active", "passed", "failed"];

const QUORUM = 100;

export function useProposals() {
    const chainId = useChainId();
    const publicClient = usePublicClient();
    const contractAddress = GOVERNANCE_ADDRESSES[chainId];

    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    const { data: proposalIds, error } = useReadContract({
        address: contractAddress,
        abi,
        functionName: "getAllProposalIds",
    });

    useEffect(() => {
        if (!proposalIds || !publicClient) return;

        const fetchDetails = async () => {
            setIsLoading(true);
            setIsError(false);

            try {
                const details: Proposal[] = await Promise.all(
                    (proposalIds as `0x${string}`[]).map(async (proposalId) => {
                        const result = await publicClient.readContract({
                            address: contractAddress,
                            abi,
                            functionName: "proposals",
                            args: [proposalId],
                        }) as readonly [any, string, string, string, any, any, number, bigint, bigint];

                        const status = (STATUS_MAP[Number(result[7])] ?? "pending") as ProposalStatus;

                        const proposal: Proposal = {
                            id: proposalId,
                            title: result[1],
                            description: result[2],
                            proposer: result[3],
                            startTime: Number(result[4]),
                            endTime: Number(result[5]),
                            status,
                            totalVotes: {
                                for: Number(result[7]),
                                against: Number(result[8]),
                            },
                            quorum: QUORUM,
                            votesPerChain: [
                                { chain: "BSC Testnet", for: Number(result[7]), against: Number(result[8]) },
                                { chain: "Arbitrum Sepolia", for: 0, against: 0 },
                            ],
                        };

                        return proposal;
                    })
                );

                setProposals(details);
            } catch (err) {
                setIsError(true);
                console.error("Failed to fetch proposal details:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [proposalIds, contractAddress, publicClient]);

    if (error) setIsError(true);

    return { proposals, isLoading, isError };
}
