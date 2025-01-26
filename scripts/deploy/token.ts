import { deployAndVerify } from "./utils";
import "dotenv/config";

async function main() {
    const network = process.env.HARDHAT_NETWORK;

    if (!network) {
        throw new Error("Please specify a network using --network");
    }

    // Deploy the contract
    console.log(`Deploying PGVToken to ${network}...`);
    await deployAndVerify("PGVToken", [], network, "tokenContract");
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
});