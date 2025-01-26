import { CHAINS_INFO } from "../../constants/chains";
import { deployAndVerify } from "./utils";
import { contracts } from "../../constants/contracts";
import chalk from "chalk";
import "dotenv/config";

async function main() {
    // Get the PGVToken address from constants/contracts.ts
    const pgvTokenAddress = contracts.bscTestnet.tokenContract;

    if (!pgvTokenAddress) {
        console.error("PGVToken address not found in constants/contracts.ts");
        process.exit(1);
    }

    console.log(chalk.yellow("Deploying GovernanceBSC to BSC Testnet..."));
    await deployAndVerify(
        "GovernanceBSC",
        [pgvTokenAddress],
        CHAINS_INFO.BSC_TESTNET.networkKey,
        "governanceContract"
    );

    console.log(chalk.green("GovernanceBSC deployed and verified successfully!"));
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
});
