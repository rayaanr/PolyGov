import { ethers, run } from "hardhat";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { contracts } from "../../constants/contracts";

const CONTRACTS_PATH = join(__dirname, "../../constants/contracts.ts");

type ContractType = "tokenContract" | "governanceContract";

/**
 * Updates the contracts.ts file with the new contract address.
 * Replaces any existing address or string.
 */
function updateContractsFile(
    network: string,
    contractType: ContractType,
    address: string
) {
    let contractsContent = readFileSync(CONTRACTS_PATH, "utf8");

    // Update the contract address in the contracts object
    const updatedContracts = { ...contracts };
    updatedContracts[network][contractType] = address;

    // Generate the new file content
    const newContent = `export interface Contracts {
    [key: string]: {
        tokenContract: string;
        governanceContract: string;
    };
}

export const contracts: Contracts = ${JSON.stringify(updatedContracts, null, 4)};`;

    writeFileSync(CONTRACTS_PATH, newContent);
    console.info(`Updated contracts.ts with ${network} ${contractType} address: ${address}`);
}

/**
 * Deploys a contract and returns the deployed instance.
 */
async function deployContract(contractName: string, args: any[] = []) {
    const Contract = await ethers.getContractFactory(contractName);
    const contract = await Contract.deploy(...args);
    await contract.waitForDeployment();
    return contract;
}

/**
 * Verifies a contract on the block explorer.
 */
async function verifyContract(address: string, args: any[]) {
    try {
        await run("verify:verify", { address, constructorArguments: args });
    } catch (error) {
        if (error instanceof Error && !error.message.includes("Already Verified")) {
            console.error("Verification failed:", error.message);
        }
    }
}

/**
 * Deploys, verifies, and updates the contracts.ts file.
 */
export async function deployAndVerify(
    contractName: string,
    args: any[] = [],
    network: string,
    contractType: ContractType
) {
    const contract = await deployContract(contractName, args);
    const address = await contract.getAddress();

    updateContractsFile(network, contractType, address);

    const tx = contract.deploymentTransaction();
    await tx?.wait(5);

    await verifyContract(address, args);
    return address;
}
