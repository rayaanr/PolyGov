// utils/nonceManager.ts
import { ethers } from "ethers";

class NonceManager {
    private addressNonces: Map<string, number> = new Map();
    private pendingNonces: Map<string, Set<number>> = new Map();
    private provider: ethers.Provider;

    constructor(provider: ethers.Provider) {
        this.provider = provider;
    }

    async getNonceForAddress(address: string): Promise<number> {
        // If we don't have a cached nonce, get it from the network
        if (!this.addressNonces.has(address)) {
            const onChainNonce = await this.provider.getTransactionCount(address);
            this.addressNonces.set(address, onChainNonce);
            this.pendingNonces.set(address, new Set());
        }

        const currentNonce = this.addressNonces.get(address)!;
        const pendingSet = this.pendingNonces.get(address)!;
        
        // Find the next available nonce
        let nonce = currentNonce;
        while (pendingSet.has(nonce)) {
            nonce++;
        }
        
        // Mark this nonce as pending
        pendingSet.add(nonce);
        return nonce;
    }

    confirmNonce(address: string, nonce: number): void {
        const pendingSet = this.pendingNonces.get(address);
        if (pendingSet) {
            pendingSet.delete(nonce);
        }
        
        // Update the base nonce if this was the lowest pending
        const currentNonce = this.addressNonces.get(address);
        if (currentNonce !== undefined && nonce === currentNonce) {
            this.addressNonces.set(address, nonce + 1);
        }
    }

    releaseNonce(address: string, nonce: number): void {
        const pendingSet = this.pendingNonces.get(address);
        if (pendingSet) {
            pendingSet.delete(nonce);
        }
    }

    async resetNonce(address: string): Promise<void> {
        const onChainNonce = await this.provider.getTransactionCount(address);
        this.addressNonces.set(address, onChainNonce);
        this.pendingNonces.set(address, new Set());
    }
}

export default NonceManager;