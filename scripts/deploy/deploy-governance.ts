import { deployAndVerify } from "./utils";
import { Wallet } from "ethers";
import { contracts } from "../../constants/contracts";
import chalk from "chalk";
import { network } from "hardhat"; // Import Hardhat's network detection
import "dotenv/config";

async function main() {
    const detectedNetwork = network.name; // Get Hardhat network name

    // Hardcoded network mapping to avoid mismatches
    const networkMapping: Record<string, string> = {
        "bscTestnet": "bscTestnet",
        "arbitrumTestnet": "arbitrumTestnet",
    };

    if (!networkMapping[detectedNetwork]) {
        console.error(`❌ Unsupported network: ${detectedNetwork}. Use 'bscTestnet' or 'arbitrumTestnet'.`);
        process.exit(1);
    }

    console.log(chalk.blue(`🔍 Detected Network: ${chalk.green(detectedNetwork)}`));

    // Get relayer address from private key
    const relayerPrivateKey = process.env.RELAYER_PVT_KEY;
    if (!relayerPrivateKey) {
        console.error("❌ RELAYER_PVT_KEY not set in .env");
        process.exit(1);
    }

    const relayerWallet = new Wallet(relayerPrivateKey);
    const relayerAddress = relayerWallet.address;
    console.log(chalk.blue(`🔑 Derived relayer address: ${chalk.green(relayerAddress)}`));

    // Get PGVToken address for the selected network
    const pgvTokenAddress = contracts[detectedNetwork].tokenContract;
    if (!pgvTokenAddress) {
        console.error(`❌ PGVToken address not found for ${detectedNetwork} in contracts.ts`);
        process.exit(1);
    }

    console.log(chalk.yellow(`🚀 Deploying Governance Contract to ${detectedNetwork}...`));
    await deployAndVerify(
        "Governance",
        [pgvTokenAddress, relayerAddress], // Constructor arguments
        detectedNetwork, // Network key for verification
        "governanceContract"
    );

    console.log(chalk.green(`✅ Governance contract deployed and verified successfully on ${detectedNetwork}!`));
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
