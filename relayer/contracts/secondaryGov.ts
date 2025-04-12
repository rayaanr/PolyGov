import { Contract } from "ethers";

export class SecondaryGovernance {
    private contract: Contract;

    constructor(contract: Contract) {
        this.contract = contract;
    }

    async mirrorProposal(
        proposalId: string,
        title: string,
        ipfsHash: string,
        startTime: number,
        endTime: number,
        proposer: string
    ) {
        const tx = await this.contract.mirrorProposal(
            proposalId,
            title,
            ipfsHash,
            startTime,
            endTime,
            proposer
        );
        await tx.wait();
        return tx;
    }

    async getProposalDetails(proposalId: string) {
        return await this.contract.getProposalDetails(proposalId);
    }

    async finalizeVotes(proposalId: string) {
        const tx = await this.contract.finalizeVotes(proposalId);
        await tx.wait();
        return tx;
    }

    async updateProposalStatus(proposalId: string, status: number) {
        const tx = await this.contract.updateProposalStatus(proposalId, status);
        await tx.wait();
        return tx;
    }
}
