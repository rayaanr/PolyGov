import { deployAndVerify } from "./utils";
import { Wallet } from "ethers";
import { CHAINS_INFO } from "../../constants/chains";
import { contracts } from "../../constants/contracts";
import chalk from "chalk";
import "dotenv/config";

async function main() {
    // Get relayer address from private key
    const relayerPrivateKey = process.env.RELAYER_PVT_KEY;

    if (!relayerPrivateKey) {
        console.error("RELAYER_PVT_KEY not set in .env");
        process.exit(1);
    }

    const relayerWallet = new Wallet(relayerPrivateKey);
    const relayerAddress = relayerWallet.address;
    console.log(chalk.blue(`Derived relayer address: ${chalk.green(relayerAddress)}`));

    // Get the PGVToken address from constants/contracts.ts
    const pgvTokenAddress = contracts.arbitrumTestnet.tokenContract;

    if (!pgvTokenAddress) {
        console.error("PGVToken address not found in constants/contracts.ts");
        process.exit(1);
    }

    console.log(chalk.yellow("Deploying GovernanceARB to Arbitrum Testnet..."));
    await deployAndVerify(
        "GovernanceARB",
        [pgvTokenAddress, relayerAddress], // Pass both arguments to the constructor
        CHAINS_INFO.ARB_TESTNET.networkKey,
        "governanceContract"
    );

    console.log(chalk.green("GovernanceARB deployed and verified successfully!"));
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
});
