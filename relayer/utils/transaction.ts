// utils/transaction.ts
import { ethers } from "ethers";
import NonceManager from "./nonceManager";

// Map to store nonce managers for each provider
const nonceManagers = new Map<string, NonceManager>();

export function getNonceManager(provider: ethers.Provider): NonceManager {
    const providerId = (provider as any).connection?.url || "default";
    if (!nonceManagers.has(providerId)) {
        nonceManagers.set(providerId, new NonceManager(provider));
    }
    return nonceManagers.get(providerId)!;
}

export async function sendTransactionWithManagedNonce(
    contract: ethers.Contract,
    method: string,
    args: any[],
    retries = 3
): Promise<ethers.TransactionReceipt> {
    const signer = contract.runner as ethers.Wallet;
    const address = await signer.getAddress();
    const provider = signer.provider!;
    const nonceManager = getNonceManager(provider);
    
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // Get managed nonce
            const nonce = await nonceManager.getNonceForAddress(address);
            
            console.log(`📤 Sending transaction ${method} with nonce ${nonce} (attempt ${attempt + 1}/${retries + 1})`);
            
            // Call contract method with explicit nonce
            const tx = await contract[method](...args, {
                nonce: nonce
            });
            
            console.log(`⏳ Waiting for transaction ${tx.hash} to be mined...`);
            const receipt = await tx.wait();
            
            // Confirm nonce was used successfully
            nonceManager.confirmNonce(address, nonce);
            
            return receipt;
        } catch (error: any) {
            lastError = error;
            
            // Check if this is a nonce error
            const errorMessage = error?.message?.toLowerCase() || '';
            const errorReason = error?.reason?.toLowerCase() || '';
            const isNonceError = 
                errorMessage.includes('nonce too low') || 
                errorMessage.includes('nonce has already been used') ||
                errorReason.includes('nonce too low') ||
                errorReason.includes('nonce has already been used');
            
            if (isNonceError) {
                console.log(`⚠️ Nonce error detected, resetting nonce for ${address}`);
                await nonceManager.resetNonce(address);
            } else {
                // If it's not a nonce error, release the nonce and throw
                if (attempt === retries) {
                    throw error;
                }
            }
            
            // Add delay between retries
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
    
    throw lastError;
}