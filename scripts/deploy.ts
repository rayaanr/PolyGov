import { ethers } from "hardhat";

async function main() {
    // Deploy GovernanceBSC to BSC Testnet
    const GovernanceBSC = await ethers.getContractFactory("GovernanceBSC");
    const governanceBSC = await GovernanceBSC.deploy();
    await governanceBSC.waitForDeployment();
    console.log("GovernanceBSC deployed to:", await governanceBSC.getAddress());

    // Deploy GovernanceARB to Arbitrum Testnet
    const GovernanceARB = await ethers.getContractFactory("GovernanceARB");
    const governanceARB = await GovernanceARB.deploy();
    await governanceARB.waitForDeployment();
    console.log("GovernanceARB deployed to:", await governanceARB.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
