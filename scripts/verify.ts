import { run } from "hardhat";

async function verify(contractAddress: string, args: any[]) {
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (e) {
        if (e instanceof Error && e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.error(e);
        }
    }
}

export { verify };
