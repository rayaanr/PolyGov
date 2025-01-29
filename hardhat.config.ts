import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import { CHAINS_INFO } from "./constants/chains";

const config: HardhatUserConfig = {
    solidity: "0.8.28",
    networks: {
        bscTestnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545",
            chainId: 97,
            accounts: [process.env.OWNER_PVT_KEY!],
        },
        // Arbitrum Testnet
        arbitrumTestnet: {
            url: "https://sepolia-rollup.arbitrum.io/rpc",
            chainId: 421614,
            accounts: [process.env.OWNER_PVT_KEY!],
        },
    },
    etherscan: {
        apiKey: {
            bscTestnet: process.env.BSCSCAN_API_KEY!,
            arbitrumTestnet: "I2GDHYCNDURPR4U8JFYG3DN747QKUVXKM8",
        },
        customChains: [
            {
                network: "arbitrumTestnet",
                chainId: 421614,
                urls: {
                    apiURL: "https://api-sepolia.arbiscan.io/api",
                    browserURL: "https://sepolia.arbiscan.io/",
                },
            },
        ],
    },
    typechain: {
        outDir: "typechain-types",
        target: "ethers-v6",
    },
};

export default config;
