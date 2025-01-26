import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    const GovernanceBSC = await ethers.getContractFactory("GovernanceBSC");
    const governance = await GovernanceBSC.deploy();

    console.log("Transaction hash:", governance.deploymentTransaction()?.hash);
    await governance.waitForDeployment();

    console.log("GovernanceBSC deployed to:", await governance.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
