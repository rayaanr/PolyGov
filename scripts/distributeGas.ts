import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { testAccounts } from "../constants/accounts";

dotenv.config();

// Amount of gas (ETH/BNB) to send
const GAS_AMOUNT = ethers.parseEther("0.05");

async function distributeGas() {
    console.log("\n🔹 Starting Gas Distribution...\n");

    const [deployer] = await ethers.getSigners();

    for (let account of testAccounts) {
        try {
            const tx = await deployer.sendTransaction({
                to: account.address,
                value: GAS_AMOUNT,
            });

            console.log(`✅ Sent ${ethers.formatEther(GAS_AMOUNT)} ETH/BNB to ${account.address}`);
            console.log(`   Transaction Hash: ${tx.hash}\n`);

            await tx.wait(); // Wait for confirmation
        } catch (error) {
            console.error(`❌ Failed to send gas to ${account.address}:`, error);
        }
    }

    console.log("\n✅ Gas distribution complete!\n");
}

distributeGas()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
