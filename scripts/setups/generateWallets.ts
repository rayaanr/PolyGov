import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    const totalWallets = 10; // Total wallets to generate
    const walletsPerChain = totalWallets / 2; // 5 wallets for each chain
    const chains = ["Chain1", "Chain2"]; // Names of the chains
    const walletData: { [chain: string]: { address: string; privateKey: string }[] } = {};

    // Generate wallets for each chain
    chains.forEach((chain, chainIndex) => {
        walletData[chain] = [];
        for (let i = 0; i < walletsPerChain; i++) {
            const wallet = ethers.Wallet.createRandom();
            walletData[chain].push({
                address: wallet.address,
                privateKey: wallet.privateKey,
            });
        }
    });

    // Save to wallets.json
    const filename = `configs/wallets.json`;
    fs.writeFileSync(filename, JSON.stringify(walletData, null, 2));
    console.log(`Generated wallets and saved to ${filename}`);

    // Print addresses for easy copying
    console.log("\nGenerated Wallets by Chain:");
    Object.keys(walletData).forEach((chain) => {
        console.log(`\n${chain}:`);
        walletData[chain].forEach((wallet, index) => {
            console.log(`${index + 1}. ${wallet.address}`);
        });
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
