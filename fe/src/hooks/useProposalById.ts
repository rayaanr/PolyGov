import { useState, useEffect, useRef } from "react";
import CONFIG, { MAIN_CONFIG } from "@/constants/config";
import useChainProposalDetails from "./useChainProposalDetails";
import { CombinedProposal, SecondaryProposal } from "@/lib/types";
import { isProposalDetails, isSecondaryProposalDetails } from "./useProposals";

// Helper function to serialize BigInt
const serializeBigInt = (obj: any) => {
    return JSON.stringify(obj, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
    );
};

const useProposalById = (proposalId: string) => {
    const isFirstRender = useRef(true);

    const [result, setResult] = useState({
        proposal: null as CombinedProposal | null,
        isLoading: true,
        error: null as Error | null,
    });

    const {
        proposals: mainProposals,
        isLoading: isLoadingMain,
        error: mainError,
    } = useChainProposalDetails(MAIN_CONFIG, [proposalId]);

    // Explicitly call useChainProposalDetails for each secondary chain (assuming 2 chains)
    const secondaryChain1 = CONFIG.SECONDARY_CHAINS[0];
    // const secondaryChain2 = CONFIG.SECONDARY_CHAINS[1];

    const {
        proposals: proposals1,
        isLoading: isLoading1,
        error: error1,
    } = useChainProposalDetails(secondaryChain1, [proposalId]);

    const secondaryChains = [
        {
            proposals: proposals1,
            isLoading: isLoading1,
            error: error1,
            chainName: secondaryChain1.name,
            chainId: secondaryChain1.chainId,
        },
    ];

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const isLoading = isLoadingMain || secondaryChains.some((chain) => chain.isLoading);

        if (isLoading) {
            setResult((prev) => {
                if (prev.isLoading && prev.error === null && prev.proposal === null) {
                    return prev;
                }
                return {
                    proposal: null,
                    isLoading: true,
                    error: null,
                };
            });
            return;
        }

        const errors: Error[] = [mainError, ...secondaryChains.map((chain) => chain.error)].filter(
            (e): e is Error => e !== null
        );

        if (errors.length > 0) {
            setResult((prev) => {
                if (!prev.isLoading && prev.error?.message === errors[0].message) {
                    return prev;
                }
                return {
                    proposal: null,
                    isLoading: false,
                    error: errors[0],
                };
            });
            return;
        }

        const mainProposal = mainProposals?.[0];
        if (!mainProposal || !isProposalDetails(mainProposal)) {
            setResult((prev) => {
                const errorMsg = "Invalid main proposal details";
                if (!prev.isLoading && prev.error?.message === errorMsg) {
                    return prev;
                }
                return {
                    proposal: null,
                    isLoading: false,
                    error: new Error(errorMsg),
                };
            });
            return;
        }

        const secondaryProposals: SecondaryProposal[] = [];
        for (const chain of secondaryChains) {
            const proposal = chain.proposals?.[0];
            if (proposal && isSecondaryProposalDetails(proposal)) {
                secondaryProposals.push({
                    chainName: chain.chainName,
                    proposal: proposal,
                });
            }
        }

        const combinedProposal: CombinedProposal = {
            id: proposalId,
            mainProposal,
            secondaryProposals,
        };

        setResult((prev) => {
            if (
                prev.proposal?.id !== combinedProposal.id ||
                serializeBigInt(prev.proposal?.mainProposal) !==
                    serializeBigInt(combinedProposal.mainProposal) ||
                prev.proposal?.secondaryProposals.length !==
                    combinedProposal.secondaryProposals.length
            ) {
                return {
                    proposal: combinedProposal,
                    isLoading: false,
                    error: null,
                };
            }
            return prev;
        });
    }, [proposalId, mainProposals, isLoadingMain, mainError, secondaryChains]);

    return result;
};

export default useProposalById;
