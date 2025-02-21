import { ignition, run, network, ethers } from "hardhat";
import GovernanceModule from "../modules/Governance";
import fs from "fs";

async function main() {
    console.log(`🚀 Deploying Governance on ${network.name} (Chain ID: ${network.config.chainId})...\n`);

    // Deploy the contract using Ignition
    const { governance } = await ignition.deploy(GovernanceModule);
    const contractAddress = await governance.getAddress();

    console.log(`✅ Governance contract deployed at: ${contractAddress}\n`);

    // Save deployment address to JSON
    saveDeploymentAddress(contractAddress);

    // Wait for blockchain indexing before verification
    console.log("⏳ Waiting for confirmations before verification...");
    await new Promise((resolve) => setTimeout(resolve, 15000)); // 15-second delay

    // Verify the contract
    await verifyContract(contractAddress);
}

// Function to get deployment JSON file dynamically based on chain ID
function getDeploymentFilePath(): string {
    const chainId = network.config.chainId;
    return `deployments/chain-${chainId}/deployed_addresses.json`;
}

// Function to save the deployed address
function saveDeploymentAddress(contractAddress: string) {
    const deploymentPath = getDeploymentFilePath();

    let deploymentData: any = {};
    if (fs.existsSync(deploymentPath)) {
        deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    }

    deploymentData["GovernanceModule#Governance"] = contractAddress;
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

    console.log(`📁 Governance contract address saved in ${deploymentPath}`);
}

// Function to verify the contract
async function verifyContract(contractAddress: string, retries = 5, delay = 10000) {
    const deploymentPath = getDeploymentFilePath();

    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`Deployment JSON file not found: ${deploymentPath}`);
    }

    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    const pgvTokenAddress = deploymentData["PGVTokenModule#PGVToken"];
    const relayerAddress = process.env.RELAYER_ADDRESS;

    if (!pgvTokenAddress || !relayerAddress) {
        throw new Error("❌ Missing PGVToken or relayer address.");
    }

    console.log(`🔍 Using PGVToken: ${pgvTokenAddress}, Relayer: ${relayerAddress}`);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔍 Attempting contract verification (Try ${attempt}/${retries})...`);

            await run("verify:verify", {
                address: contractAddress,
                constructorArguments: [pgvTokenAddress, relayerAddress],
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

// Run the deployment & verification
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment script failed:", error);
        process.exit(1);
    });
