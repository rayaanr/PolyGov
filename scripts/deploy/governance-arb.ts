import { deployAndVerify } from "./utils";
import { Wallet } from "ethers";
import { KEYS } from "../../constants/keys";
import { contracts } from "../../constants/contracts";
import "dotenv/config";

async function main() {
    // Get relayer address from private key
    const relayerPrivateKey = process.env.RELAYER_PVT_KEY;

    if (!relayerPrivateKey) {
        throw new Error("RELAYER_PVT_KEY not set in .env");
    }

    const relayerWallet = new Wallet(relayerPrivateKey);
    const relayerAddress = relayerWallet.address;
    console.log(`Derived relayer address: ${relayerAddress}`);

    // Get the PGVToken address from constants/contracts.ts
    const pgvTokenAddress = contracts.arbitrumTestnet.tokenContract;

    if (!pgvTokenAddress) {
        throw new Error("PGVToken address not found in constants/contracts.ts");
    }

    console.log("Deploying GovernanceARB to Arbitrum Testnet...");
    await deployAndVerify(
        "GovernanceARB",
        [pgvTokenAddress, relayerAddress], // Pass both arguments to the constructor
        KEYS.ARB_TESTNET,
        "governanceContract"
    );
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
});