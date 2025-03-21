"use client";

import { MAIN_CONFIG } from "@/constants/config";
import { GET_PROPOSAL_DETAILS_KEY, GET_PROPOSAL_IDS_KEY } from "@/constants/keys";
import { formatDate, formatVotes, getStatusText } from "@/lib/utils";
import { useReadContract, useReadContracts } from "wagmi";

interface ProposalDetails {
    proposalId: string;
    title: string;
    description: string;
    yesVotes: bigint;
    noVotes: bigint;
    startTime: bigint;
    endTime: bigint;
    status: number;
    finalYesVotes: bigint;
    finalNoVotes: bigint;
    voteTallyFinalized: boolean;
}

const ProposalList = () => {
    // Get all proposal IDs
    const {
        data: proposalIds,
        isLoading: isLoadingIds,
        error: idsError,
    } = useReadContract({
        address: MAIN_CONFIG.contracts.governance,
        chainId: MAIN_CONFIG.chainId,
        abi: MAIN_CONFIG.abi.governance,
        functionName: GET_PROPOSAL_IDS_KEY,
    }) as { data: string[] | undefined; isLoading: boolean; error: Error | null };

    // Get latest 6 proposal IDs (or all if less than 6)
    const latestProposalIds = proposalIds?.slice(-6).reverse() || [];

    // Use useReadContracts for multiple calls
    const {
        data: proposalsData,
        isLoading: isLoadingDetails,
        error: detailsError,
    } = useReadContracts({
        contracts: latestProposalIds.map((proposalId) => ({
            address: MAIN_CONFIG.contracts.governance,
            chainId: MAIN_CONFIG.chainId,
            abi: MAIN_CONFIG.abi.governance,
            functionName: GET_PROPOSAL_DETAILS_KEY,
            args: [proposalId],
        })),
    });

    if (isLoadingIds) {
        return <div>Loading proposal IDs...</div>;
    }

    if (idsError) {
        return <div>Error loading proposal IDs: {idsError.message}</div>;
    }

    if (!proposalIds || proposalIds.length === 0) {
        return <div>No proposals found</div>;
    }

    return (
        <div>
            <h2>Latest Proposals (Up to 6)</h2>
            <p>Total Proposals: {proposalIds.length}</p>

            {isLoadingDetails && <p>Loading proposal details...</p>}
            {detailsError && <p>Error fetching details: {detailsError.message}</p>}

            {proposalsData?.map((proposalResult, index) => {
                const proposalDetails = proposalResult.result as ProposalDetails | undefined;
                const proposalId = latestProposalIds[index];

                return (
                    <div key={proposalId}>
                        <h3>
                            Proposal #{proposalIds.length - index}: {proposalId}
                        </h3>
                        {proposalDetails ? (
                            <div>
                                <p>Title: {proposalDetails.title}</p>
                                <p>Description: {proposalDetails.description}</p>
                                <p>Yes Votes: {formatVotes(proposalDetails.yesVotes)}</p>
                                <p>No Votes: {formatVotes(proposalDetails.noVotes)}</p>
                                <p>Start Time: {formatDate(Number(proposalDetails.startTime))}</p>
                                <p>End Time: {formatDate(Number(proposalDetails.endTime))}</p>
                                <p>Status: {getStatusText(proposalDetails.status)}</p>
                                <p>Final Yes Votes: {formatVotes(proposalDetails.finalYesVotes)}</p>
                                <p>Final No Votes: {formatVotes(proposalDetails.finalNoVotes)}</p>
                                <p>
                                    Vote Tally Finalized:{" "}
                                    {proposalDetails.voteTallyFinalized ? "Yes" : "No"}
                                </p>
                            </div>
                        ) : (
                            <p>No details available</p>
                        )}
                        <hr />
                    </div>
                );
            })}
        </div>
    );
};

export default ProposalList;
