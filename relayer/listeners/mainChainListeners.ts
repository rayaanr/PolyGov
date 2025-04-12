import { MainGovernance } from "../contracts/mainGov";
import { SecondaryGovernance } from "../contracts/secondaryGov";
import { ContractConnections } from "../types";

export function setupMainChainListeners(
    mainGov: MainGovernance,
    secondaryConnections: Record<string, ContractConnections>
) {
    console.log("🎧 Setting up Main Chain event listeners...");

    const contract = mainGov['contract']; // Access the raw ethers.js contract for event listening

    // Listen for ProposalCreated
    contract.on("ProposalCreated", async (proposalId: string) => {
        console.log(`🆕 New proposal created: ${proposalId}`);
        try {
            const proposal = await mainGov.getProposalDetails(proposalId);
            for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
                const secondaryGov = new SecondaryGovernance(contract);
                await secondaryGov.mirrorProposal(
                    proposalId,
                    proposal.title,
                    proposal.ipfsHash,
                    proposal.startTime,
                    proposal.endTime,
                    proposal.proposer
                );
                console.log(`✅ Mirrored proposal ${proposalId} to ${chainId}`);
            }
        } catch (error) {
            console.error(`❌ Error mirroring proposal ${proposalId}:`, error);
        }
    });

    // Listen for ProposalExecuted
    contract.on("ProposalExecuted", async (proposalId, mainStatus) => {
        console.log(`🚀 Proposal executed on main chain: ${proposalId}`);
        const status = mapMainStatusToSecondary(Number(mainStatus));

        if (status === null) {
            console.log(`ℹ️ Skipping update for status ${mainStatus}`);
            return;
        }

        for (const [chainId, { contract }] of Object.entries(secondaryConnections)) {
            const secondaryGov = new SecondaryGovernance(contract);
            try {
                await secondaryGov.updateProposalStatus(proposalId, status);
                console.log(`✅ Updated proposal ${proposalId} status on ${chainId}`);
            } catch (error) {
                console.error(`❌ Error updating proposal status on ${chainId}:`, error);
            }
        }
    });
}

function mapMainStatusToSecondary(mainStatus: number): number | null {
    // Mapping: 0 = Pending, 1 = Accepted, 2 = Rejected, 3 = Executed
    if (mainStatus === 1 || mainStatus === 3) return 1; // Accepted
    if (mainStatus === 2) return 2; // Rejected
    return null;
}
