import { ignition, run, network } from "hardhat";
import PGVTokenModule from "../modules/PGVToken";

async function main() {
    console.log(`Deploying PGVToken on ${network.name} using Hardhat Ignition...`);

    // Deploy using Ignition
    const { pgvToken } = await ignition.deploy(PGVTokenModule);
    const contractAddress = await pgvToken.getAddress();

    console.log(`PGVToken deployed to: ${contractAddress}`);

    // Wait before verifying to allow blockchain indexing
    console.log("Waiting for blockchain confirmation...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify contract
    try {
        console.log("Verifying contract...");
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: [],
        });
        console.log("Contract verified successfully!");
    } catch (error: any) {
        console.error("Verification failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
