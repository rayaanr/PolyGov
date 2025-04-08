import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();


export const CONFIG = {
    MAIN: {
        CHAIN_ID: "main",
        RPC_URL: process.env.ARB_RPC || "",
        WS_URL: process.env.ARB_WS_URL || "",
        CONTRACT: "0x8Dfdc3D4837aa7cB73B664536Fb0557Af7C82c5d",
    },
    SECONDARY_CHAINS: [
        {
            CHAIN_ID: "bsc",
            RPC_URL: process.env.BSC_RPC || "",
            WS_URL: process.env.BSC_WS_URL || "",
            CONTRACT: "0x8Dfdc3D4837aa7cB73B664536Fb0557Af7C82c5d",
        },
    ],
};

export const MAIN_GOVERNANCE_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/main.json"), "utf8")
);

export const SECONDARY_GOVERNANCE_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../abi/secondary.json"), "utf8")
);

export const CACHE_FILE_PATH = path.join(__dirname, "proposal_cache.json");