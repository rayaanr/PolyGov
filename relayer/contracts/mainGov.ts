import { Contract } from "ethers";

export class MainGovernance {
    private contract: Contract;

    constructor(contract: Contract) {
        this.contract = contract;
    }

    async getProposalDetails(proposalId: string) {
        return await this.contract.getProposalDetails(proposalId);
    }

    async finalizeProposalVotes(proposalId: string) {
        const tx = await this.contract.finalizeProposalVotes(proposalId);
        await tx.wait();
        return tx;
    }

    async collectSecondaryChainVotes(
        proposalId: string,
        chainId: string,
        yesVotes: bigint,
        noVotes: bigint
    ) {
        const tx = await this.contract.collectSecondaryChainVotes(
            proposalId,
            chainId,
            yesVotes,
            noVotes
        );
        await tx.wait();
        return tx;
    }

    async getSecondaryChainVotes(proposalId: string, chainId: string) {
        return await this.contract.getSecondaryChainVotes(proposalId, chainId);
    }

    async getRegisteredChains() {
        return await this.contract.getRegisteredChains();
    }

    async getProposalIds() {
        return await this.contract.getProposalIds();
    }
}
