import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import { testAccounts } from "../constants/accounts";

dotenv.config();

// Get the gas amount from an environment variable
const inputAmount = process.env.GAS_AMOUNT;

if (!inputAmount) {
    console.error("❌ Please provide the amount of ETH/BNB to send via GAS_AMOUNT env variable!");
    process.exit(1);
}

const GAS_AMOUNT = ethers.parseEther(inputAmount);

async function distributeGas() {
    console.log(
        `\n🔹 Starting Gas Distribution (Amount: ${inputAmount} ${
            network.name === "bscTestnet" ? "BNB" : "ETH"
        }) 🔹\n`
    );

    const [deployer] = await ethers.getSigners();

    for (let account of testAccounts) {
        try {
            const tx = await deployer.sendTransaction({
                to: account.address,
                value: GAS_AMOUNT,
            });

            console.log(`✅ Sent ${inputAmount} ETH/BNB to ${account.address}`);
            console.log(`   Transaction Hash: ${tx.hash}\n`);

            await tx.wait(); // Wait for confirmation
        } catch (error) {
            console.error(`❌ Failed to send gas to ${account.address}:`, error);
        }
    }

    console.log("\n✅ Gas distribution completed successfully on ", network.name);
}

distributeGas()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
