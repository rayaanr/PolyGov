import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import { CHAINS_INFO } from "./constants/chains";

const config: HardhatUserConfig = {
    solidity: "0.8.28",
    networks: {
        bscTestnet: {
            url: CHAINS_INFO.BSC_TESTNET.pubRpcUrl,
            chainId: CHAINS_INFO.BSC_TESTNET.chainId,
            accounts: [process.env.OWNER_PVT_KEY!],
        },
        // Arbitrum Testnet
        arbitrumTestnet: {
            url: CHAINS_INFO.ARB_TESTNET.pubRpcUrl,
            chainId: CHAINS_INFO.ARB_TESTNET.chainId,
            accounts: [process.env.OWNER_PVT_KEY!],
        },
    },
    etherscan: {
        apiKey: {
            bscTestnet: process.env.BSCSCAN_API_KEY!,
            arbitrumTestnet: process.env.ARBITRUMSCAN_API_KEY!,
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
