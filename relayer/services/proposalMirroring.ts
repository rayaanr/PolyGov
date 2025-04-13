import { SecondaryGovernance } from "../contracts/secondaryGov";
import { decodeCustomError } from "../utils/decodeCustomError"; 
import { SECONDARY_GOVERNANCE_ABI } from "../config";

export async function mirrorProposalToSecondaryChain(
    secondaryGovernance: SecondaryGovernance,
    proposalId: string,
    proposal: any,
    chainId: string
) {
    try {
        const existingProposal = await secondaryGovernance.getProposalDetails(proposalId);

        if (existingProposal.startTime > 0n) {
            console.log(`ℹ️ Proposal ${proposalId} already exists on ${chainId}`);
            return;
        }
    } catch (err) {
        // If fetching fails, assume proposal doesn't exist
        console.log(`⚠️ Proposal ${proposalId} not found on ${chainId}, proceeding to mirror...`);
    }

    try {
        const tx = await secondaryGovernance.mirrorProposal(
            proposalId,
            proposal.title,
            proposal.ipfsHash,
            proposal.startTime,
            proposal.endTime,
            proposal.proposer
        );
        await tx.wait();
        console.log(`✅ Successfully mirrored proposal ${proposalId} to ${chainId}`);
    } catch (error: any) {
        const rawData = error?.error?.data || error?.data; // ✅ Grab raw revert data
        const decodedError = rawData ? decodeCustomError(rawData, SECONDARY_GOVERNANCE_ABI) : null; // ✅ Decode

        if (error?.error?.message?.includes("already known") || error?.message?.includes("already known")) {
            console.log(`⚠️ Transaction for proposal ${proposalId} already sent to ${chainId}, skipping...`);
            return;
        }

        if (decodedError) {
            console.error(`❌ Custom Error while mirroring proposal ${proposalId} on ${chainId}: ${decodedError}`);
        } else {
            console.error(`❌ Unknown error mirroring proposal ${proposalId} on ${chainId}:`, error);
        }
    }
}
