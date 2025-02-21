import { ignition, run, network, ethers } from "hardhat";
import PGVTokenModule from "../modules/PGVToken";

async function main() {
    console.log(`🚀 Deploying PGVToken on ${network.name} using Hardhat Ignition...\n`);

    // Deploy the contract using Ignition
    const { pgvToken } = await ignition.deploy(PGVTokenModule);
    const contractAddress = await pgvToken.getAddress();

    console.log(`✅ PGVToken deployed at: ${contractAddress}\n`);

    // Wait for blockchain indexing before verifying
    console.log("⏳ Waiting for confirmations before verification...");
    await new Promise((resolve) => setTimeout(resolve, 15000)); // 15-second delay to ensure indexing

    // Contract Verification with Retry Logic
    await verifyContract(contractAddress);
}

// Function to verify the contract
async function verifyContract(contractAddress: string, retries = 5, delay = 10000) {
    const constructorArgs = ["PolyGov Token", "PGV", ethers.parseEther("10000")]; // Adjust initial supply if needed

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔍 Attempting contract verification (Try ${attempt}/${retries})...`);

            await run("verify:verify", {
                address: contractAddress,
                constructorArguments: constructorArgs,
            });

            console.log("✅ Contract verified successfully!");
            return;
        } catch (error: any) {
            console.error(`❌ Verification attempt ${attempt} failed:`, error.message);

            if (attempt < retries) {
                console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                console.error("❌ Contract verification failed after multiple attempts.");
            }
        }
    }
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment script failed:", error);
        process.exit(1);
    });
