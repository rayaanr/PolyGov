import { deployAndVerify } from "./deploy";
import { Wallet } from "ethers";
import "dotenv/config";

async function main() {
    // Get private key from environment
    const relayerPrivateKey = process.env.RELAYER_PVT_KEY;

    if (!relayerPrivateKey) {
        throw new Error("RELAYER_PVT_KEY not set in .env");
    }

    // Create wallet from private key
    const relayerWallet = new Wallet(relayerPrivateKey);

    // Get checksum address
    const relayerAddress = relayerWallet.address;
    console.log(`Derived relayer address: ${relayerAddress}`);

    // Deploy contract with derived address
    await deployAndVerify("GovernanceARB", [relayerAddress], "arbitrumTestnet");
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
});
