import { ethers } from "hardhat";

async function main() {
  const GovernanceARB = await ethers.getContractFactory("GovernanceARB");
  const governanceARB = await GovernanceARB.deploy();
  await governanceARB.waitForDeployment();
  console.log("GovernanceARB deployed to:", await governanceARB.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});