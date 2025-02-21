import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import fs from "fs";
import { network } from "hardhat";

export default buildModule("GovernanceModule", (m) => {
    // ✅ Get the chain ID dynamically
    const chainId = network.config.chainId;
    if (!chainId) {
        throw new Error("❌ Unable to determine chain ID.");
    }

    // ✅ Construct the correct JSON file path
    const jsonFilePath = `deployments/chain-${chainId}/deployed_addresses.json`;

    // ✅ Ensure the JSON file exists
    if (!fs.existsSync(jsonFilePath)) {
        console.warn(`⚠️ Deployment JSON file not found. Creating: ${jsonFilePath}`);
        fs.mkdirSync(`deployments/chain-${chainId}`, { recursive: true });
        fs.writeFileSync(jsonFilePath, JSON.stringify({}, null, 2));
    }

    // ✅ Read the deployment JSON file
    const deploymentData = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));

    // ✅ Check if PGVToken exists
    if (!deploymentData["PGVTokenModule#PGVToken"]) {
        console.warn(`⚠️ PGVToken address is missing in ${jsonFilePath}. Please deploy PGVToken first.`);
        throw new Error(`❌ PGVToken address not found in ${jsonFilePath}`);
    }

    const pgvToken = deploymentData["PGVTokenModule#PGVToken"];
    console.log(`✅ Using PGVToken address: ${pgvToken}`);

    // ✅ Define the relayer address
    const relayer = m.getParameter("relayerAddress");

    // ✅ Deploy the Governance contract
    const governance = m.contract("Governance", [pgvToken, relayer]);

    return { governance };
});
