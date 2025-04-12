import { MainGovernance } from "../contracts/mainGov";
import { SecondaryGovernance } from "../contracts/secondaryGov";
import { ContractConnections } from "../types";
import { mirrorProposalToSecondaryChain } from "../services/proposalMirroring";

export async function syncProposalsBetweenChains(
    mainGov: MainGovernance,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🔄 Syncing proposals between chains...");

    try {
        const proposalIds = await mainGov.getProposalIds();

        for (const proposalId of proposalIds) {
            const mainProposal = await mainGov.getProposalDetails(proposalId);

            for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                const secondaryGov = new SecondaryGovernance(contract);

                try {
                    const secondaryProposal = await secondaryGov.getProposalDetails(proposalId);

                    if (secondaryProposal.startTime === 0n) {
                        console.log(
                            `🔄 Proposal ${proposalId} missing on ${chainId}, mirroring...`
                        );
                        await mirrorProposalToSecondaryChain(
                            secondaryGov,
                            proposalId,
                            mainProposal,
                            chainId
                        );
                    } else {
                        console.log(`✅ Proposal ${proposalId} already exists on ${chainId}`);
                    }
                } catch (error) {
                    console.log(`⚠️ Proposal ${proposalId} not found on ${chainId}, mirroring...`);
                    await mirrorProposalToSecondaryChain(
                        secondaryGov,
                        proposalId,
                        mainProposal,
                        chainId
                    );
                }
            }
        }
    } catch (error) {
        console.error("❌ Error syncing proposals:", error);
    }
}
