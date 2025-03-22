import { useState, useEffect, useMemo, useRef } from "react";
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

    const secondaryChainConfigs = useMemo(() => CONFIG.SECONDARY_CHAINS, []);

    const secondaryResultsArray = secondaryChainConfigs.map((chain) => {
        return useChainProposalDetails(chain, [proposalId]);
    });

    const secondaryChains = useMemo(() => {
        return secondaryChainConfigs.map((chain, index) => {
            const result = secondaryResultsArray[index];
            return {
                proposals: result.proposals,
                isLoading: result.isLoading,
                error: result.error,
                chainName: chain.name,
                chainId: chain.chainId,
            };
        });
    }, [
        secondaryChainConfigs,
        // Use serializeBigInt instead of JSON.stringify
        secondaryResultsArray
            .map((r) =>
                serializeBigInt({
                    proposals: r.proposals,
                    isLoading: r.isLoading,
                    errorMsg: r.error?.message,
                })
            )
            .join("|"),
    ]);

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
    }, [
        proposalId,
        serializeBigInt({
            proposals: mainProposals,
            error: mainError?.message,
        }),
        isLoadingMain,
        secondaryChains,
    ]);

    return result;
};

export default useProposalById;
