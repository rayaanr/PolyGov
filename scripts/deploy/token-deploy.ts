import { ethers, network, run } from "hardhat";

async function main() {
    // Get the deployer's account
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy the PGVToken contract
    const PGVTokenFactory = await ethers.getContractFactory("PGVToken");
    const pgvToken = await PGVTokenFactory.deploy();

    console.log("PGVToken deployed to:", await pgvToken.getAddress());

    // Verify the contract on both networks
    if (network.name === "bscTestnet" || network.name === "arbitrumTestnet") {
        console.log(`Waiting for a few blocks to confirm before verifying...`);
        await pgvToken.deploymentTransaction()?.wait(5); // Wait for 5 blocks

        console.log("Verifying contract on Etherscan...");
        try {
            await run("verify:verify", {
                address: await pgvToken.getAddress(),
                constructorArguments: [],
            });
            console.log("Contract verified successfully!");
        } catch (error) {
            console.error("Verification failed:", error);
        }
    }
}

// Run the deployment script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
