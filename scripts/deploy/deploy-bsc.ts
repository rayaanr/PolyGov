import { deployAndVerify } from "./deploy";
import "dotenv/config";

async function main() {
  await deployAndVerify("GovernanceBSC", [], "bscTestnet");
}

main().catch(console.error);
