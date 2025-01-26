import { KEYS } from "../../constants/keys";
import { deployAndVerify } from "./utils";
import { contracts } from "../../constants/contracts";
import "dotenv/config";

async function main() {
    // Get the PGVToken address from constants/contracts.ts
    const pgvTokenAddress = contracts.bscTestnet.tokenContract;

    if (!pgvTokenAddress) {
        throw new Error("PGVToken address not found in constants/contracts.ts");
    }

    console.log("Deploying GovernanceBSC to BSC Testnet...");
    await deployAndVerify(
        "GovernanceBSC",
        [pgvTokenAddress],
        KEYS.BSC_TESTNET,
        "governanceContract"
    );
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
});
