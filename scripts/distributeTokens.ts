import { ethers } from "hardhat";

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { testAccounts } from "../constants/accounts";

dotenv.config();

// Function to get the current network chain ID dynamically
async function getChainId(): Promise<string> {
    const network = await ethers.provider.getNetwork();
    return network.chainId.toString();
}

// Function to load the PGVToken contract address dynamically
async function getTokenAddress(): Promise<string> {
    const chainId = await getChainId();
    const deploymentPath = path.join(
        __dirname,
        `../ignition/deployments/chain-${chainId}/deployed_addresses.json`
    );

    try {
        const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        const tokenAddress = deploymentData["PGVTokenModule#PGVToken"]; // Key from your JSON
        if (!tokenAddress) throw new Error("Token address not found in deployment JSON");

        console.log(`✅ PGVToken Address for Chain ID ${chainId}: ${tokenAddress}`);
        return tokenAddress;
    } catch (error) {
        console.error(`❌ Error loading deployment for chain ID ${chainId}:`, error);
        process.exit(1);
    }
}

// Distribution Rules
const MIN_TOKENS = 200;
const MAX_TOKENS = 2000;
const TOTAL_ALLOCATION = 7500; // 75% of 10,000
const DECIMALS = 18;

// Extract Addresses from testAccounts
const recipients = testAccounts.map((account) => account.address);

// Function to generate random allocations ensuring sum = TOTAL_ALLOCATION
const generateAllocations = (numRecipients: number, total: number, min: number, max: number) => {
    let allocations: number[] = Array(numRecipients).fill(min);
    let remaining = total - numRecipients * min;

    while (remaining > 0) {
        for (let i = 0; i < numRecipients && remaining > 0; i++) {
            let addAmount = Math.min(Math.floor(Math.random() * (max - min + 1)), remaining);
            allocations[i] += addAmount;
            remaining -= addAmount;
        }
    }

    return allocations;
};

async function main() {
    // Get the deployer signer
    const [deployer] = await ethers.getSigners();
    console.log(`Using deployer account: ${deployer.address}`);

    // Get the PGVToken contract address dynamically
    const TOKEN_ADDRESS = await getTokenAddress();

    // Connect to the PGVToken contract
    const tokenContract = await ethers.getContractAt("PGVToken", TOKEN_ADDRESS);

    // Generate Token Allocations
    const allocations = generateAllocations(
        recipients.length,
        TOTAL_ALLOCATION,
        MIN_TOKENS,
        MAX_TOKENS
    );

    console.log("🚀 Starting token distribution...");
    for (let i = 0; i < recipients.length; i++) {
        const amount = ethers.parseUnits(allocations[i].toString(), DECIMALS);
        console.log(`Sending ${allocations[i]} tokens to ${recipients[i]}...`);

        try {
            const tx = await tokenContract.transfer(recipients[i], amount);
            await tx.wait();
            console.log(`✅ Successfully sent ${allocations[i]} tokens to ${recipients[i]}`);
        } catch (error) {
            console.error(`❌ Error sending to ${recipients[i]}:`, error);
        }
    }
    console.log("🎉 Token distribution completed.");
}

// Execute the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
