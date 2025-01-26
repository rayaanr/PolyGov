import { ethers, run } from "hardhat";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(__dirname, "../config.ts");
const CONFIG_TEMPLATE = `import { NetworkConfig } from "./scripts/types";

export const config: NetworkConfig = {
  arb: { contractAddress: "ARB_GOV_ADDRESS" },
  bsc: { contractAddress: "BSC_GOV_ADDRESS" }
};`;

function ensureConfigFile() {
    if (!existsSync(CONFIG_PATH)) {
        writeFileSync(CONFIG_PATH, CONFIG_TEMPLATE);
        console.log("Config file created with default template.");
    }
}

function updateConfig(network: string, contractAddress: string) {
    ensureConfigFile();
    let config = readFileSync(CONFIG_PATH, "utf8");

    const replacement =
        network === "arbitrumTestnet"
            ? `arb: { contractAddress: "${contractAddress}" }`
            : `bsc: { contractAddress: "${contractAddress}" }`;

    config = config.replace(
        new RegExp(`${network === "arbitrumTestnet" ? "arb" : "bsc"}:.*?}`, "s"),
        replacement
    );

    writeFileSync(CONFIG_PATH, config);
    console.log(`Updated config.ts with ${network} contract address`);
}

async function deployContract(contractName: string, args: any[] = []) {
    const Contract = await ethers.getContractFactory(contractName);
    const contract = await Contract.deploy(...args);
    await contract.waitForDeployment();
    return contract;
}

async function verifyContract(address: string, args: any[]) {
    try {
        await run("verify:verify", { address, constructorArguments: args });
    } catch (error) {
        if (error instanceof Error && !error.message.includes("Already Verified")) {
            console.error("Verification failed:", error.message);
        }
    }
}

export async function deployAndVerify(contractName: string, args: any[] = [], network: string) {
    const contract = await deployContract(contractName, args);
    const address = await contract.getAddress();

    updateConfig(network, address);

    const tx = contract.deploymentTransaction();
    await tx?.wait(5);

    await verifyContract(address, args);
    return address;
}
