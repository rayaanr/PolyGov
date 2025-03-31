import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();


export const CONFIG = {
    MAIN: {
        CHAIN_ID: "main",
        RPC_URL: process.env.ARB_RPC || "",
        WS_URL: process.env.ARB_WS_URL || "",
        CONTRACT: "0x6843a77F821a80D71Ac994c5288A2a061ec77d53",
    },
    SECONDARY_CHAINS: [
        {
            CHAIN_ID: "bsc",
            RPC_URL: process.env.BSC_RPC || "",
            WS_URL: process.env.BSC_WS_URL || "",
            CONTRACT: "0x402BD069C8a175f083025b10C56791340296CC6A",
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