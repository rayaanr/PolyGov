interface ChainInfo {
    name: string;
    networkKey: string;
    chainId: number;
    pubRpcUrl: string;
    apiURL: string;
    blockExplorer: string;
}

export const CHAINS_INFO: Record<string, ChainInfo> = {
    BSC_TESTNET: {
        name: "BSC Testnet",
        networkKey: "bscTestnet",
        chainId: 97,
        pubRpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
        apiURL: "https://api-testnet.bscscan.com/api",
        blockExplorer: "https://testnet.bscscan.com/",
    },
    ARB_TESTNET: {
        name: "Arbitrum Sepolia",
        networkKey: "arbitrumTestnet",
        chainId: 421614,
        pubRpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
        apiURL: "https://api-sepolia.arbiscan.io/api",
        blockExplorer: "https://sepolia.arbiscan.io/",
    },
} as const;

export type Chain = keyof typeof CHAINS_INFO;
