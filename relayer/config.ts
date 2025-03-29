
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
dotenv.config();
import { WebSocketProvider } from "ethers";

export const CONFIG = {
    MAIN: {
        CHAIN_ID: "main",
        RPC_URL: process.env.ARB_RPC || "",
        WS_URL: process.env.ARB_WS_URL || "",
        CONTRACT: "0x9C9047b0aDBBBd11E6dcc654ad8F275854E896Ac",
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